import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============ TYPE DEFINITIONS ============

/** Chat message role */
export type ChatMessageRole = 'assistant' | 'system' | 'user';

/** Chat message status */
export type ChatMessageStatus = 'delivered' | 'error' | 'pending' | 'read' | 'sending';

/** Interface for fake chat message */
export interface FakeChatMessage {
  /** Message content */
  content: string;
  /** Unique identifier */
  id: string;
  /** Message role */
  role: ChatMessageRole;
  /** Message delivery status */
  status: ChatMessageStatus;
  /** Timestamp */
  timestamp: string;
}

/** Interface for fake chat user */
export interface FakeChatUser {
  /** Avatar URL */
  avatar: string;
  /** Display name */
  displayName: string;
  /** Unique identifier */
  id: string;
  /** Whether user is online */
  isOnline: boolean;
}

// ============ CONSTANTS FOR ITERATION ============

/** All message roles */
export const CHAT_MESSAGE_ROLES: ChatMessageRole[] = ['assistant', 'system', 'user'];

/** All message statuses */
export const CHAT_MESSAGE_STATUSES: ChatMessageStatus[] = [
  'delivered',
  'error',
  'pending',
  'read',
  'sending',
];

/** Sample assistant responses */
export const CHAT_ASSISTANT_RESPONSES = [
  i18n.t('factory.promptChat.iCanHelpYouWith', 'I can help you with that. Let me look into it.'),
  i18n.t('factory.promptChat.hereIsTheInformationYou', 'Here is the information you requested.'),
  i18n.t('factory.promptChat.wouldYouLikeMeTo', 'Would you like me to elaborate on that?'),
  i18n.t('factory.promptChat.thatIsAGreatQuestion', 'That is a great question. Let me explain.'),
  i18n.t(
    'factory.promptChat.iHaveProcessedYourRequest',
    'I have processed your request successfully.'
  ),
];

/** Sample user messages */
export const CHAT_USER_MESSAGES = [
  i18n.t('factory.promptChat.canYouHelpMeWith', 'Can you help me with this?'),
  i18n.t('factory.promptChat.whatIsTheStatusOf', 'What is the status of my request?'),
  i18n.t('factory.promptChat.pleaseProvideMoreDetails', 'Please provide more details.'),
  i18n.t('factory.promptChat.thankYouForTheInformation', 'Thank you for the information.'),
  i18n.t('factory.promptChat.howDoIProceedFrom', 'How do I proceed from here?'),
];

// ============ SINGLE ITEM FACTORY ============

/**
 * Creates a single fake chat message
 * @param overrides - Optional partial overrides
 * @returns A fake chat message
 */
export function createFakeChatMessage(overrides?: Partial<FakeChatMessage>): FakeChatMessage {
  const role = faker.helpers.arrayElement(CHAT_MESSAGE_ROLES);
  const messages = role === 'user' ? CHAT_USER_MESSAGES : CHAT_ASSISTANT_RESPONSES;

  return {
    id: faker.string.uuid(),
    content: faker.helpers.arrayElement(messages),
    role,
    status: faker.helpers.arrayElement(CHAT_MESSAGE_STATUSES),
    timestamp: faker.date.recent({ days: 1 }).toISOString(),
    ...overrides,
  };
}

// ============ BULK FACTORY ============

/**
 * Creates multiple fake chat messages
 * @param count - Number of messages to generate
 * @returns Array of fake chat messages
 */
export function createFakeChatMessages(count: number): FakeChatMessage[] {
  return Array.from({ length: count }, () => createFakeChatMessage());
}

// ============ SPECIALIZED FACTORIES ============

/**
 * Creates a user message
 * @param content - Message content
 * @returns A user chat message
 */
export function createFakeUserMessage(content?: string): FakeChatMessage {
  return createFakeChatMessage({
    role: 'user',
    content: content ?? faker.helpers.arrayElement(CHAT_USER_MESSAGES),
    status: 'delivered',
  });
}

/**
 * Creates an assistant message
 * @param content - Message content
 * @returns An assistant chat message
 */
export function createFakeAssistantMessage(content?: string): FakeChatMessage {
  return createFakeChatMessage({
    role: 'assistant',
    content: content ?? faker.helpers.arrayElement(CHAT_ASSISTANT_RESPONSES),
    status: 'delivered',
  });
}

/**
 * Creates a fake chat user
 * @param overrides - Optional partial overrides
 * @returns A fake chat user
 */
export function createFakeChatUser(overrides?: Partial<FakeChatUser>): FakeChatUser {
  return {
    id: faker.string.uuid(),
    displayName: faker.person.fullName(),
    avatar: faker.image.avatar(),
    isOnline: faker.datatype.boolean(),
    ...overrides,
  };
}

/**
 * Creates a conversation thread with alternating messages
 * @param messageCount - Number of messages
 * @returns Array of alternating user/assistant messages
 */
export function createFakeChatThread(messageCount = 6): FakeChatMessage[] {
  return Array.from({ length: messageCount }, (_, i) =>
    createFakeChatMessage({
      role: i % 2 === 0 ? 'user' : 'assistant',
      timestamp: new Date(Date.now() - (messageCount - i) * 60_000).toISOString(),
      status: 'delivered',
    })
  );
}
