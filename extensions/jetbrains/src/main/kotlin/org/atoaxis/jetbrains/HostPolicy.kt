package org.atoaxis.jetbrains

import java.nio.file.Path

internal object HostPolicy {
    fun editor(productCode: String): String? = when (productCode) {
        "IC", "IU" -> "intellij-idea"
        "PC", "PY" -> "pycharm"
        else -> null
    }

    fun observedPath(base: String, file: String): String? = runCatching {
        val root = Path.of(base).normalize()
        val path = Path.of(file).normalize()
        if (root.isAbsolute && path.isAbsolute && path != root && path.startsWith(root)) path.toString() else null
    }.getOrNull()
}
