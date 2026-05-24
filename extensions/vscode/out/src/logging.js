"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
class Logger {
    isDebugEnabled;
    constructor(isDebugEnabled) {
        this.isDebugEnabled = isDebugEnabled;
    }
    debug(message, extra) {
        if (!this.isDebugEnabled()) {
            return;
        }
        console.log("[wakaclock]", message, extra ?? "");
    }
    warn(message, extra) {
        console.warn("[wakaclock]", message, extra ?? "");
    }
    error(message, extra) {
        console.error("[wakaclock]", message, extra ?? "");
    }
}
exports.Logger = Logger;
//# sourceMappingURL=logging.js.map