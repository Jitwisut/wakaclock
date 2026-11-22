package org.atoaxis.jetbrains

import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.io.IOException
import java.nio.file.Files
import java.util.UUID
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

class TrackingDispatcherTest {
    @get:Rule val temp = TemporaryFolder()

    @Test fun cliReceivesLiteralMetadataAndHostIdentity() {
        assumeTrue(File.separator == "/")
        val cli = temp.newFile("fake cli")
        cli.writeText("#!/bin/sh\nprintf '%s\\0' \"\$WAKACLOCK_EDITOR\" \"\$@\" > \"\$0.args\"\n")
        assertTrue(cli.setExecutable(true))
        val id = UUID.fromString("e139c218-b84d-4024-8715-2b37c5ab4b14")
        val path = temp.newFile("file \$name;? with\nnewline.py").canonicalPath
        for (editor in listOf("pycharm", "intellij-idea")) {
            for (kind in ActivityKind.entries) {
                CliSender(cli.absolutePath, editor, temp.root.canonicalPath).send(Observation(path, kind, 1700000000123, id))
                val actual = File(cli.path + ".args").readText().removeSuffix("\u0000").split('\u0000')
                val expected = listOf(editor, "heartbeat", "--entity", path, "--type", "file",
                    "--category", "coding", "--time", (1700000000123L / 1000.0).toString(),
                    "--heartbeat-id", id.toString(), "--plugin", "atoaxis-jetbrains/0.1.0")
                assertEquals(if (kind == ActivityKind.SAVE) expected + "--write" else expected, actual)
            }
        }
    }

    @Test fun reportsCliFailureWithoutLeakingOutput() {
        assumeTrue(File.separator == "/")
        val cli = temp.newFile("failing-cli")
        cli.writeText("#!/bin/sh\necho private-path >&2\nexit 13\n")
        assertTrue(cli.setExecutable(true))
        val error = assertThrows(IOException::class.java) {
            CliSender(cli.absolutePath, "pycharm", temp.root.canonicalPath).send(Observation(cli.canonicalPath, ActivityKind.SAVE, 1))
        }
        assertEquals("CLI returned an error.", error.message)
    }

    @Test fun queuedFileMovedOutsideProjectIsNeverHandedToCli() {
        assumeTrue(File.separator == "/")
        val cli = temp.newFile("unexpected-cli")
        cli.writeText("#!/bin/sh\nexit 41\n")
        assertTrue(cli.setExecutable(true))
        val project = temp.newFolder("project").canonicalFile
        val path = Files.createFile(project.toPath().resolve("selected.py"))
        val event = Observation(path.toString(), ActivityKind.EDIT, 1)
        val sender = CliSender(cli.absolutePath, "pycharm", project.path)
        Files.delete(path)
        sender.send(event)
        Files.createSymbolicLink(path, temp.newFile("external.py").toPath())
        sender.send(event)
    }

    @Test fun saveReplacesOnlyItsPendingEditAndSenderRunsOffCallerThread() {
        val entered = CountDownLatch(1)
        val release = CountDownLatch(1)
        val delivered = CountDownLatch(3)
        val caller = Thread.currentThread()
        val events = CopyOnWriteArrayList<Observation>()
        TrackingDispatcher({ event ->
            check(Thread.currentThread() !== caller)
            if (event.kind == ActivityKind.FOCUS) {
                entered.countDown()
                check(release.await(5, TimeUnit.SECONDS))
            }
            events.add(event)
            delivered.countDown()
        }, { error(it) }, 100, 8).use { dispatcher ->
            dispatcher.record("A", ActivityKind.FOCUS)
            assertTrue(entered.await(5, TimeUnit.SECONDS))
            repeat(30) { dispatcher.record("A", ActivityKind.EDIT) }
            repeat(15) { dispatcher.record("B", ActivityKind.EDIT) }
            dispatcher.record("A", ActivityKind.SAVE)
            release.countDown()
            assertTrue(delivered.await(5, TimeUnit.SECONDS))
        }
        assertEquals(3, events.size)
        assertEquals(setOf("A" to ActivityKind.FOCUS, "A" to ActivityKind.SAVE, "B" to ActivityKind.EDIT),
            events.map { it.path to it.kind }.toSet())
        assertEquals(3, events.map { it.id }.toSet().size)
    }

    @Test fun disablingCancelsQueuedActivityAndOverflowIsReportedOnce() {
        val warnings = mutableListOf<String>()
        val events = CopyOnWriteArrayList<Observation>()
        val dispatcher = TrackingDispatcher({ events.add(it) }, { warnings.add(it) }, 60000, 1)
        dispatcher.use {
            it.record("A", ActivityKind.EDIT)
            it.record("B", ActivityKind.EDIT)
            it.record("C", ActivityKind.EDIT)
            assertEquals(1, warnings.size)
        }
        dispatcher.record("D", ActivityKind.SAVE)
        assertTrue(events.isEmpty())
        assertEquals(1, warnings.size)
    }
}
