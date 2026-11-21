package org.atoaxis.jetbrains

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.nio.file.Files

class HostPolicyTest {
    @get:Rule val temporary = TemporaryFolder()

    @Test fun `only pilot product codes are admitted`() {
        listOf("IC", "IU").forEach { assertEquals("intellij-idea", HostPolicy.editor(it)) }
        listOf("PC", "PY").forEach { assertEquals("pycharm", HostPolicy.editor(it)) }
        listOf("WS", "CL", "RD", "", "idea").forEach { assertNull(HostPolicy.editor(it)) }
    }

    @Test fun `cached canonical paths must be absolute and within root`() {
        val base = temporary.newFolder("project").toPath().toRealPath()
        val local = Files.createFile(base.resolve("main.kt"))
        val external = temporary.newFile("external.kt").toPath()
        val sibling = temporary.newFolder("project-other").toPath()
        val siblingFile = Files.createFile(sibling.resolve("main.kt"))
        assertEquals(local.toRealPath().toString(), HostPolicy.observedPath(base.toString(), local.toString()))
        assertNull(HostPolicy.observedPath(base.toString(), external.toString()))
        assertNull(HostPolicy.observedPath(base.toString(), siblingFile.toString()))
        assertNull(HostPolicy.observedPath(base.toString(), "relative.kt"))
        assertNull(HostPolicy.observedPath(base.toString(), base.toString()))
        val escape = Files.createSymbolicLink(base.resolve("escape.kt"), external)
        assertNull(HostPolicy.observedPath(base.toString(), escape.toRealPath().toString()))
        val inside = Files.createSymbolicLink(base.resolve("inside.kt"), local)
        assertEquals(local.toRealPath().toString(), HostPolicy.observedPath(base.toString(), inside.toRealPath().toString()))
    }
}
