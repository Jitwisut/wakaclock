import AppKit
import SafariServices
import CoreGraphics

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    func beginRequest(with context: NSExtensionContext) {
        guard let item = context.inputItems.first as? NSExtensionItem,
              let message = item.userInfo?[SFExtensionMessageKey] as? [String: Any],
              message["command"] as? String == "status" else {
            context.cancelRequest(withError: NSError(domain: "com.atoaxis.browser", code: 1))
            return
        }
        let defaults = UserDefaults(suiteName: "group.com.atoaxis.browser")!
        let idle = defaults.double(forKey: "idleSeconds")
        let age = Date().timeIntervalSince1970 - defaults.double(forKey: "presenceAt")
        let available = age >= 0 && age < 15 && defaults.bool(forKey: "available") && idle.isFinite && idle >= 0
        let response = NSExtensionItem()
        response.userInfo = [SFExtensionMessageKey: [
            "available": available,
            "idleSeconds": idle.isFinite ? idle + max(0, age) : 0,
            "focused": available && defaults.bool(forKey: "focused"),
            "sessionActive": available && defaults.bool(forKey: "sessionActive")
        ]]
        context.completeRequest(returningItems: [response])
    }
}
