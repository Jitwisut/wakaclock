package org.atoaxis.jetbrains

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.ProjectManager
import com.intellij.openapi.ui.DialogWrapper
import com.intellij.openapi.ui.ValidationInfo
import com.intellij.openapi.components.service
import java.awt.BorderLayout
import java.nio.file.Files
import java.nio.file.Path
import javax.swing.JCheckBox
import javax.swing.JComponent
import javax.swing.JLabel
import javax.swing.JPanel
import javax.swing.JTextField

class ConfigureTrackingAction : AnAction(), DumbAware {
    override fun actionPerformed(event: AnActionEvent) {
        val settings = TrackingSettings.getInstance()
        val dialog = object : DialogWrapper(event.project) {
            val enabled = JCheckBox("Enable AtoAxis tracking on this computer", settings.state.enabled)
            val executable = JTextField(settings.state.cliPath, 45)
            init { title = "AtoAxis — Opt-in Pilot"; init() }
            override fun createCenterPanel(): JComponent = JPanel(BorderLayout(0, 12)).apply {
                add(JLabel("<html>IDEA / PyCharm pilot. Sends file paths and activity metadata via your CLI.<br>Configure your account with the CLI first. This plugin reads file metadata only.<br>Choose a trusted, installed wakaclock-cli using its absolute path.</html>"), BorderLayout.NORTH)
                add(executable, BorderLayout.CENTER)
                add(enabled, BorderLayout.SOUTH)
            }
            override fun doValidate(): ValidationInfo? {
                if (!enabled.isSelected) return null
                val path = runCatching { Path.of(executable.text.trim()) }.getOrNull()
                return if (path == null || !path.isAbsolute || !Files.isRegularFile(path) || !Files.isExecutable(path))
                    ValidationInfo("Enter the absolute path of an existing executable CLI.", executable) else null
            }
        }
        if (!dialog.showAndGet()) return
        settings.loadState(TrackingSettings.Options(dialog.enabled.isSelected, dialog.executable.text.trim()))
        ProjectManager.getInstance().openProjects.forEach { it.service<TrackingHost>().reload() }
    }
}
