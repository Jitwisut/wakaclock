import AppKit
import SafariServices
import CoreGraphics

// A menu-bar companion publishes presence only. No event tap, key content or screen capture.
@main
class AppDelegate: NSObject, NSApplicationDelegate {
    private let defaults = UserDefaults(suiteName: "group.com.atoaxis.browser")!
    private var timer: Timer?
    private var item: NSStatusItem?
    private var sessionActive = true
    private var awake = true
    private var locked = false

    func applicationDidFinishLaunching(_ notification: Notification) {
        item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        item?.button?.title = "AtoAxis"
        let menu = NSMenu()
        menu.addItem(withTitle: "AtoAxis Safari tracking companion", action: nil, keyEquivalent: "")
        menu.addItem(withTitle: "Enable Safari Extension…", action: #selector(settings), keyEquivalent: ",").target = self
        menu.addItem(withTitle: "Open Dashboard", action: #selector(dashboard), keyEquivalent: "").target = self
        menu.addItem(.separator())
        menu.addItem(withTitle: "Quit (pauses Safari tracking)", action: #selector(quit), keyEquivalent: "q").target = self
        item?.menu = menu
        NSApp.setActivationPolicy(.accessory)
        let center = NSWorkspace.shared.notificationCenter
        for name in [NSWorkspace.sessionDidResignActiveNotification, NSWorkspace.screensDidSleepNotification, NSWorkspace.willSleepNotification] {
            center.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
                self?.sessionActive = false; self?.awake = false; self?.publish()
            }
        }
        for name in [NSWorkspace.sessionDidBecomeActiveNotification, NSWorkspace.screensDidWakeNotification, NSWorkspace.didWakeNotification] {
            center.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
                self?.sessionActive = true; self?.awake = true; self?.publish()
            }
        }
        let distributed = DistributedNotificationCenter.default()
        distributed.addObserver(self, selector: #selector(screenLocked), name: NSNotification.Name("com.apple.screenIsLocked"), object: nil)
        distributed.addObserver(self, selector: #selector(screenUnlocked), name: NSNotification.Name("com.apple.screenIsUnlocked"), object: nil)
        publish()
        timer = Timer.scheduledTimer(withTimeInterval: 5, repeats: true) { [weak self] _ in self?.publish() }
    }
    private func publish() {
        defaults.set(Date().timeIntervalSince1970, forKey: "presenceAt")
        let idle = CGEventSource.secondsSinceLastEventType(.combinedSessionState, eventType: .null)
        let frontmost = NSWorkspace.shared.frontmostApplication?.bundleIdentifier
        defaults.set(sessionActive && awake && !locked, forKey: "sessionActive")
        defaults.set(idle.isFinite && idle >= 0 && frontmost != nil, forKey: "available")
        defaults.set(idle.isFinite ? idle : 0, forKey: "idleSeconds")
        defaults.set(frontmost == "com.apple.Safari", forKey: "focused")
        defaults.synchronize()
    }
    func applicationWillTerminate(_ notification: Notification) {
        defaults.removeObject(forKey: "presenceAt"); defaults.synchronize()
    }
    @objc private func screenLocked() { locked = true; publish() }
    @objc private func screenUnlocked() { locked = false; publish() }
    @objc private func settings() {
        SFSafariApplication.showPreferencesForExtension(withIdentifier: "com.atoaxis.browser.Extension") { _ in }
    }
    @objc private func dashboard() { NSWorkspace.shared.open(URL(string: "https://atoaxis.com/dashboard/wakaclock")!) }
    @objc private func quit() { NSApp.terminate(nil) }
}
