package org.atoaxis.jetbrains

import com.intellij.openapi.components.PersistentStateComponent
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.State
import com.intellij.openapi.components.Storage
import com.intellij.openapi.components.RoamingType
import com.intellij.openapi.components.service

@Service(Service.Level.APP)
@State(name = "AtoAxisTracking", storages = [Storage("atoaxis.xml", roamingType = RoamingType.DISABLED)])
class TrackingSettings : PersistentStateComponent<TrackingSettings.Options> {
    data class Options(var enabled: Boolean = false, var cliPath: String = "")
    private var options = Options()
    override fun getState(): Options = options
    override fun loadState(state: Options) { options = state }
    companion object { fun getInstance(): TrackingSettings = service() }
}
