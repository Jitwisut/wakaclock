"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decideAttribution = decideAttribution;
function positive(value) {
    return value !== undefined && value > 0;
}
function isAi(actor) {
    return actor === "ai_verified" || actor === "ai_inferred";
}
function reject(code) {
    return { kind: "rejected", code };
}
/**
 * Pure mirror of wakaclock-core::heartbeat::resolve_attribution.
 *
 * Adapter-specific identity checks happen before this function and are passed as
 * `known_agent_id`; the decision itself never treats a free-form
 * agent string as proof of a named integration.
 */
function decideAttribution(input) {
    if (input.explicit_confidence !== undefined &&
        (!Number.isFinite(input.explicit_confidence) ||
            input.explicit_confidence < 0 ||
            input.explicit_confidence > 1)) {
        return reject("invalid_confidence");
    }
    const aiEvidence = input.legacy_is_ai_generated === true ||
        (input.ai_agent?.trim().length ?? 0) > 0 ||
        (input.ai_event_id?.trim().length ?? 0) > 0 ||
        input.ai_source?.toLowerCase() === "agent_hook" ||
        input.ai_source?.toLowerCase() === "mcp" ||
        positive(input.ai_lines_added) ||
        positive(input.ai_lines_deleted);
    const humanEvidence = input.positive_editor_evidence === true ||
        positive(input.human_lines_added) ||
        positive(input.human_lines_deleted) ||
        positive(input.keystrokes) ||
        positive(input.chars_added) ||
        positive(input.chars_deleted);
    const ambiguousLines = positive(input.unattributed_lines_added) || positive(input.unattributed_lines_deleted);
    const attributionLines = positive(input.ai_lines_added) ||
        positive(input.ai_lines_deleted) ||
        positive(input.human_lines_added) ||
        positive(input.human_lines_deleted) ||
        ambiguousLines;
    if (aiEvidence && humanEvidence && input.explicit_actor_type === undefined) {
        return reject("conflicting_ai_and_human_evidence");
    }
    let actorType;
    const explicit = input.explicit_actor_type;
    if (explicit !== undefined) {
        if (isAi(explicit) && input.legacy_is_ai_generated === false) {
            return reject("explicit_ai_conflicts_with_legacy_false");
        }
        if (!isAi(explicit) && input.legacy_is_ai_generated === true) {
            return reject("explicit_non_ai_conflicts_with_legacy_true");
        }
        if (!isAi(explicit) && aiEvidence && !(explicit === "unknown" && ambiguousLines)) {
            return reject("explicit_non_ai_conflicts_with_ai_evidence");
        }
        if (isAi(explicit) && humanEvidence) {
            return reject("explicit_ai_conflicts_with_human_evidence");
        }
        if (explicit === "human" && attributionLines && aiEvidence) {
            return reject("human_contains_ai_lines");
        }
        if (explicit === "human" && ambiguousLines) {
            return reject("human_contains_ambiguous_lines");
        }
        if (explicit !== "human" &&
            explicit !== "unknown" &&
            (positive(input.human_lines_added) || positive(input.human_lines_deleted))) {
            return reject("ai_contains_human_lines");
        }
        if (explicit === "unknown" && (aiEvidence || input.positive_editor_evidence === true || positive(input.human_lines_added) || positive(input.human_lines_deleted)) && !ambiguousLines) {
            return reject("unknown_contains_positive_evidence");
        }
        actorType = explicit;
    }
    else if (aiEvidence) {
        const source = input.ai_source?.trim().toLowerCase();
        const verifiedSource = source === "agent_hook" ||
            source === "mcp" ||
            source === "structured_mcp" ||
            source === "transcript";
        const verified = verifiedSource &&
            (input.ai_confidence?.trim().toLowerCase() === "verified" ||
                source === "agent_hook" ||
                source === "mcp") &&
            input.known_agent_id === true;
        actorType = verified ? "ai_verified" : "unknown";
    }
    else if (ambiguousLines) {
        actorType = "unknown";
    }
    else if (humanEvidence) {
        actorType = "human";
    }
    else {
        actorType = "unknown";
    }
    const confidence = input.explicit_confidence ??
        (actorType === "human"
            ? 1
            : actorType === "ai_verified"
                ? input.ai_source?.toLowerCase() === "mcp"
                    ? 0.95
                    : 1
                : actorType === "ai_inferred"
                    ? input.ai_confidence?.toLowerCase() === "correlated"
                        ? 0.8
                        : 0.6
                    : 0);
    return { kind: "resolved", actor_type: actorType, confidence };
}
//# sourceMappingURL=attributionDecision.js.map