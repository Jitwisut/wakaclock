package org.atoaxis.jetbrains

import java.io.File
import java.io.IOException
import java.nio.file.Files
import java.nio.file.Path
import java.util.UUID
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.ScheduledThreadPoolExecutor
import java.util.concurrent.TimeUnit

enum class ActivityKind { FOCUS, EDIT, SAVE }

internal data class Observation(
    val path: String,
    val kind: ActivityKind,
    val millis: Long,
    val id: UUID = UUID.randomUUID()
)

internal class CliSender(private val executable: String, private val editor: String, projectRoot: String) {
    private val root = Path.of(projectRoot).normalize()
    private val realRoot = runCatching { root.toRealPath() }.getOrNull()
    init {
        require(File(executable).isAbsolute) { "Choose an absolute path to the AtoAxis CLI." }
        require(editor in setOf("intellij-idea", "pycharm"))
    }

    fun send(event: Observation) {
        // The IDE supplies canonical VFS identities. Recheck on the worker in case the
        // queued file or a parent directory has since become an external symlink.
        val path = Path.of(event.path).normalize()
        if (realRoot == null || !path.startsWith(root)) return
        val resolved = runCatching { path.toRealPath() }.getOrNull() ?: return
        if (resolved != realRoot.resolve(root.relativize(path)) || !Files.isRegularFile(resolved)) return
        val args = mutableListOf(executable, "heartbeat", "--entity", resolved.toString(), "--type", "file",
            "--category", "coding", "--time", (event.millis / 1000.0).toString(),
            "--heartbeat-id", event.id.toString(), "--plugin", "atoaxis-jetbrains/0.1.0")
        if (event.kind == ActivityKind.SAVE) args.add("--write")
        val builder = ProcessBuilder(args)
            .redirectOutput(ProcessBuilder.Redirect.DISCARD)
            .redirectError(ProcessBuilder.Redirect.DISCARD)
        builder.environment()["WAKACLOCK_EDITOR"] = editor
        val process = builder.start()
        try {
            process.outputStream.close()
            if (!process.waitFor(30, TimeUnit.SECONDS)) throw IOException("CLI timed out.")
            if (process.exitValue() != 0) throw IOException("CLI returned an error.")
        } finally {
            if (process.isAlive) process.destroyForcibly()
        }
    }
}

/** The IDE thread only records metadata. Each document's edit window starts with its first edit. */
class TrackingDispatcher internal constructor(
    private val send: (Observation) -> Unit,
    private val onFailure: (String) -> Unit,
    private val editWindowMs: Long,
    private val capacity: Int
) : AutoCloseable {
    constructor(cliPath: String, editor: String, projectRoot: String, onFailure: (String) -> Unit) :
        this(CliSender(cliPath, editor, projectRoot)::send, onFailure, 30_000, 512)

    private val executor = ScheduledThreadPoolExecutor(1) { run ->
        Thread(run, "AtoAxis CLI delivery").apply { isDaemon = true }
    }.apply { removeOnCancelPolicy = true }

    private class Pending(var event: Observation) {
        lateinit var task: ScheduledFuture<*>
    }
    private val edits = mutableMapOf<String, Pending>()
    private var queued = 0
    private var warned = false
    private var closed = false

    fun record(path: String, kind: ActivityKind) {
        if (!enqueue(path, kind)) warn("AtoAxis is busy. Some file activity could not be handed to the CLI.")
    }

    @Synchronized
    private fun enqueue(path: String, kind: ActivityKind): Boolean {
        if (closed) return true
        val now = System.currentTimeMillis()
        val existing = edits[path]
        if (existing != null && kind == ActivityKind.EDIT) {
            existing.event = existing.event.copy(millis = now)
            return true
        }
        if (existing != null && kind == ActivityKind.SAVE) {
            edits.remove(path)
            if (existing.task.cancel(false)) queued--
        }
        if (queued >= capacity) return false
        val pending = Pending(Observation(path, kind, now))
        if (kind == ActivityKind.EDIT) edits[path] = pending
        queued++
        pending.task = executor.schedule({
            val observation = synchronized(this) {
                if (closed || pending.task.isCancelled) return@schedule
                queued--
                edits.remove(path, pending)
                pending.event
            }
            try {
                send(observation)
                synchronized(this) { warned = false }
            } catch (_: InterruptedException) {
                Thread.currentThread().interrupt()
            } catch (_: Exception) {
                warn("AtoAxis could not hand file activity to the CLI. Check the executable and its account configuration.")
            }
        }, if (kind == ActivityKind.EDIT) editWindowMs else 0, TimeUnit.MILLISECONDS)
        return true
    }

    private fun warn(message: String) {
        synchronized(this) {
            if (closed || warned) return
            warned = true
        }
        onFailure(message)
    }

    @Synchronized
    override fun close() {
        closed = true
        edits.clear()
        executor.shutdownNow()
        executor.queue.clear()
    }
}
