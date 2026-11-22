# Building AtoAxis for JetBrains IDEs

Install JDK 21 and set `JAVA_HOME` to that JDK. From this directory run:

```sh
./gradlew test buildPlugin
```

Windows: `gradlew.bat test buildPlugin`.

The installable archive is `build/distributions/atoaxis-jetbrains-0.1.0.zip`.
In IntelliJ IDEA or PyCharm, open Settings → Plugins → gear menu → Install Plugin
from Disk and select the ZIP. Restart if prompted.

The build pins Gradle 8.13 (including its distribution SHA-256), Kotlin 2.1.20,
the JetBrains IntelliJ Platform Gradle plugin 2.6.0, and the IntelliJ IDEA Community
2025.1.7 SDK. Java 21 bytecode and platform build 251 are the minimum supported
baseline. The plugin uses common platform APIs rather than Java/Python language
plugin dependencies. PyCharm runtime compatibility must still be checked in the
actual IDE; compiling against IntelliJ does not constitute that runtime check.

The first build downloads the SDK and Maven dependencies. Archives have stable
entry ordering and timestamps. Kotlin's standard library is provided by the IDE
and is not bundled again. Gradle daemon persistence, parallel compilation and
incremental Kotlin compilation are disabled to keep local storage bounded.

For a disposable validation environment, set `GRADLE_USER_HOME` to one dedicated
cache directory. Measure it and `build/` before and after substantial builds.
After all Gradle/IDE processes using them have exited, retain the distribution ZIP
and test reports, and remove only that task's disposable cache and sandbox outputs.
Do not remove another task's shared Gradle cache.
