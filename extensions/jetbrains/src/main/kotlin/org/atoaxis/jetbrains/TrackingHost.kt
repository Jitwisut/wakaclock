package org.atoaxis.jetbrains

import com.intellij.ide.AppLifecycleListener
import com.intellij.openapi.Disposable
import com.intellij.openapi.application.ApplicationInfo
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.service
import com.intellij.openapi.editor.EditorFactory
import com.intellij.openapi.editor.event.DocumentEvent
import com.intellij.openapi.editor.event.DocumentListener
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.fileEditor.FileDocumentManagerListener
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.fileEditor.FileEditorManagerEvent
import com.intellij.openapi.fileEditor.FileEditorManagerListener
import com.intellij.openapi.project.Project
import com.intellij.openapi.roots.ProjectFileIndex
import com.intellij.openapi.startup.ProjectActivity
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.openapi.vfs.LocalFileSystem
import com.intellij.openapi.wm.IdeFocusManager
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import java.awt.KeyboardFocusManager
import java.beans.PropertyChangeListener
import java.nio.file.Path
import javax.swing.SwingUtilities

class TrackingStartup : ProjectActivity {
    override suspend fun execute(project: Project) { project.service<TrackingHost>().start() }
}

/** Project lifetime owns listeners and dispatcher; no document contents are read. */
@Service(Service.Level.PROJECT)
class TrackingHost(private val project: Project) : Disposable {
    private var started = false
    @Volatile private var dispatcher: TrackingDispatcher? = null
    private var canonicalRoot: String? = null
    private var failureShown = false
    private val windowListener = PropertyChangeListener { event ->
        if (dispatcher != null && event.newValue != null) ApplicationManager.getApplication().invokeLater {
            if (dispatcher != null && !project.isDisposed) selectedFile()?.let { record(it, ActivityKind.FOCUS) }
        }
    }

    @Synchronized fun start() {
        if (started || project.isDisposed) return
        started = true
        if (HostPolicy.editor(ApplicationInfo.getInstance().build.productCode) == null) return
        val connection = project.messageBus.connect(this)
        connection.subscribe(FileEditorManagerListener.FILE_EDITOR_MANAGER, object : FileEditorManagerListener {
            override fun selectionChanged(event: FileEditorManagerEvent) { event.newFile?.let { record(it, ActivityKind.FOCUS) } }
            // Opening a selected file also raises selectionChanged; do not emit it twice.
        })
        val appConnection = ApplicationManager.getApplication().messageBus.connect(this)
        // Also catches switching between two IDE project windows, not just application activation.
        KeyboardFocusManager.getCurrentKeyboardFocusManager().addPropertyChangeListener("activeWindow", windowListener)
        appConnection.subscribe(AppLifecycleListener.TOPIC, object : AppLifecycleListener {
            override fun appWillBeClosed(isRestart: Boolean) { dispose() }
        })
        appConnection.subscribe(FileDocumentManagerListener.TOPIC, object : FileDocumentManagerListener {
            override fun beforeDocumentSaving(document: com.intellij.openapi.editor.Document) {
                if (dispatcher == null) return
                FileDocumentManager.getInstance().getFile(document)?.let { record(it, ActivityKind.SAVE) }
            }
        })
        EditorFactory.getInstance().eventMulticaster.addDocumentListener(object : DocumentListener {
            override fun documentChanged(event: DocumentEvent) {
                if (dispatcher == null || !ApplicationManager.getApplication().isDispatchThread || project.isDisposed) return
                val editor = FileEditorManager.getInstance(project).selectedTextEditor ?: return
                if (editor.document !== event.document || !editor.contentComponent.isFocusOwner) return
                FileDocumentManager.getInstance().getFile(event.document)?.let { record(it, ActivityKind.EDIT) }
            }
        }, this)
        reload()
    }

    @Synchronized fun reload() {
        dispatcher?.close()
        dispatcher = null
        canonicalRoot = null
        failureShown = false
        val settings = TrackingSettings.getInstance().state
        if (!settings.enabled || project.isDisposed) return
        // Deliberately refuse untested platform products despite the platform dependency.
        val editor = HostPolicy.editor(ApplicationInfo.getInstance().build.productCode) ?: return
        val base = project.basePath ?: return
        val root = LocalFileSystem.getInstance().findFileByPath(base)?.canonicalPath ?: return
        canonicalRoot = root
        if (runCatching { Path.of(settings.cliPath).isAbsolute }.getOrDefault(false)) {
            dispatcher = TrackingDispatcher(settings.cliPath, editor, root) {
                ApplicationManager.getApplication().invokeLater { showFailure(it) }
            }
        }
    }

    private fun selectedFile(): VirtualFile? = FileEditorManager.getInstance(project).selectedEditor?.file

    private fun record(file: VirtualFile, kind: ActivityKind) {
        val target = dispatcher ?: return
        if (project.isDisposed || !ApplicationManager.getApplication().isDispatchThread || !ApplicationManager.getApplication().isActive) return
        // Shared documents fire application-wide events; only the active project window owns them.
        val frame = IdeFocusManager.getGlobalInstance().lastFocusedFrame ?: return
        val activeWindow = KeyboardFocusManager.getCurrentKeyboardFocusManager().activeWindow ?: return
        val frameWindow = (frame.component as? java.awt.Window) ?: SwingUtilities.getWindowAncestor(frame.component)
        if (frame.project != project || frameWindow != activeWindow) return
        if (selectedFile() != file || !file.isValid || file.isDirectory || file.fileSystem.protocol != "file") return
        val index = ProjectFileIndex.getInstance(project)
        if (!index.isInContent(file) || index.isExcluded(file)) return
        val base = canonicalRoot ?: return
        // Cached VFS metadata only on the EDT. Worker revalidates filesystem identity and containment.
        val canonical = HostPolicy.observedPath(base, file.canonicalPath ?: return) ?: return
        target.record(canonical, kind)
    }

    @Synchronized private fun showFailure(message: String) {
        if (failureShown || dispatcher == null || project.isDisposed) return
        failureShown = true
        NotificationGroupManager.getInstance().getNotificationGroup("AtoAxis")
            .createNotification("AtoAxis activity tracking", message, NotificationType.WARNING)
            .notify(project)
    }

    @Synchronized override fun dispose() {
        KeyboardFocusManager.getCurrentKeyboardFocusManager().removePropertyChangeListener("activeWindow", windowListener)
        dispatcher?.close()
        dispatcher = null
    }
}
