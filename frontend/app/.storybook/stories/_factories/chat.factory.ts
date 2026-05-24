import { faker } from '@faker-js/faker';
import i18n from 'i18next';

export type ChatRole = 'assistant' | 'system' | 'user';

export interface FakeChatMessage {
  content: string;
  createdAt: string;
  id: string;
  metadata?: {
    latency?: number;
    model?: string;
    tokens?: number;
  };
  role: ChatRole;
}

export function createFakeChatMessage(role?: ChatRole): FakeChatMessage {
  const messageRole = role ?? faker.helpers.arrayElement<ChatRole>(['user', 'assistant']);

  return {
    id: faker.string.uuid(),
    role: messageRole,
    content:
      messageRole === 'user'
        ? faker.lorem.sentence({ min: 3, max: 15 })
        : faker.lorem.paragraphs({ min: 1, max: 3 }),
    createdAt: faker.date.recent().toISOString(),
    metadata:
      messageRole === 'assistant'
        ? {
            model: faker.helpers.arrayElement(['gpt-4', 'gpt-3.5-turbo', 'claude-3-opus']),
            tokens: faker.number.int({ min: 50, max: 500 }),
            latency: faker.number.int({ min: 100, max: 2000 }),
          }
        : undefined,
  };
}

export function createFakeChatHistory(count: number): FakeChatMessage[] {
  return Array.from({ length: count }, (_, i) =>
    createFakeChatMessage(i % 2 === 0 ? 'user' : 'assistant')
  );
}

// Alias for backward compatibility
export const createFakeChatMessages = createFakeChatHistory;

export interface FakeChatConversation {
  createdAt: string;
  id: string;
  messages: FakeChatMessage[];
  model: string;
  title: string;
  updatedAt: string;
}

export function createFakeChatConversation(messageCount: number = 6): FakeChatConversation {
  const messages = createFakeChatHistory(messageCount);

  return {
    id: faker.string.uuid(),
    title: faker.lorem.sentence({ min: 3, max: 6 }),
    messages,
    createdAt: faker.date.past().toISOString(),
    updatedAt: faker.date.recent().toISOString(),
    model: faker.helpers.arrayElement(['gpt-4', 'gpt-3.5-turbo', 'claude-3-opus']),
  };
}

export function createFakeChatConversations(count: number): FakeChatConversation[] {
  return Array.from({ length: count }, () =>
    createFakeChatConversation(faker.number.int({ min: 2, max: 10 }))
  );
}

export interface FakeSuggestion {
  category: string;
  id: string;
  text: string;
}

export function createFakeSuggestion(): FakeSuggestion {
  const suggestions = [
    {
      text: i18n.t('factory.chat.explainQuantumComputing', 'Explain quantum computing'),
      category: i18n.t('factory.chat.learn', 'Learn'),
    },
    {
      text: i18n.t('factory.chat.writeAHaikuAboutCoding', 'Write a haiku about coding'),
      category: i18n.t('factory.chat.creative', 'Creative'),
    },
    {
      text: i18n.t('factory.chat.debugThisCode', 'Debug this code'),
      category: i18n.t('factory.chat.code', 'Code'),
    },
    {
      text: i18n.t('factory.chat.summarizeThisArticle', 'Summarize this article'),
      category: i18n.t('factory.chat.productivity', 'Productivity'),
    },
    {
      text: i18n.t('factory.chat.generateABusinessPlan', 'Generate a business plan'),
      category: i18n.t('factory.chat.business', 'Business'),
    },
    {
      text: i18n.t('factory.chat.translateToSpanish', 'Translate to Spanish'),
      category: i18n.t('factory.chat.language', 'Language'),
    },
    {
      text: i18n.t('factory.chat.createAWorkoutPlan', 'Create a workout plan'),
      category: i18n.t('factory.chat.health', 'Health'),
    },
    {
      text: i18n.t('factory.chat.explainMachineLearning', 'Explain machine learning'),
      category: i18n.t('factory.chat.learn', 'Learn'),
    },
  ];

  const suggestion = faker.helpers.arrayElement(suggestions);

  return {
    id: faker.string.uuid(),
    ...suggestion,
  };
}

export function createFakeSuggestions(count: number = 4): FakeSuggestion[] {
  return Array.from({ length: count }, () => createFakeSuggestion());
}

export interface FakeStreamChunk {
  delta: string;
  done: boolean;
  id: string;
}

export function createFakeStreamChunks(text: string): FakeStreamChunk[] {
  const words = text.split(' ');
  const chunks: FakeStreamChunk[] = [];

  let currentChunk = '';
  words.forEach((word, index) => {
    currentChunk += (currentChunk ? ' ' : '') + word;

    // Create a chunk every 2-4 words
    if (
      currentChunk.split(' ').length >= faker.number.int({ min: 2, max: 4 }) ||
      index === words.length - 1
    ) {
      chunks.push({
        id: faker.string.uuid(),
        delta: `${currentChunk} `,
        done: index === words.length - 1,
      });
      currentChunk = '';
    }
  });

  return chunks;
}

export interface FakeChatResponse {
  conversationId: string;
  id: string;
  message: FakeChatMessage;
}

export function createFakeChatResponse(conversationId?: string): FakeChatResponse {
  return {
    id: faker.string.uuid(),
    message: createFakeChatMessage('assistant'),
    conversationId: conversationId ?? faker.string.uuid(),
  };
}

export interface FakeCodeBlock {
  code: string;
  filename?: string;
  language: string;
}

export function createFakeCodeBlock(language?: string): FakeCodeBlock {
  const languages = ['typescript', 'javascript', 'python', 'rust', 'go', 'bash'];
  const lang = language ?? faker.helpers.arrayElement(languages);

  const codeSnippets: Record<string, string> = {
    typescript: `function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

const result = greet(i18n.t('factory.chat.world', 'World'));
console.log(result);`,
    javascript: `const fetchData = async (url) => {
  const response = await fetch(url);
  const data = await response.json();
  return data;
};`,
    python: `def calculate_fibonacci(n: int) -> list[int]:
    if n <= 0:
        return []
    fib = [0, 1]
    for i in range(2, n):
        fib.append(fib[i-1] + fib[i-2])
    return fib[:n]`,
    rust: `fn main() {
    let numbers = vec![1, 2, 3, 4, 5];
    let sum: i32 = numbers.iter().sum();
    println!(i18n.t('factory.chat.sum', 'Sum: {}'), sum);
}`,
    go: `package main

import "fmt"
import i18n from 'i18next';

func main() {
    message := i18n.t('factory.chat.helloGo', 'Hello, Go!')
    fmt.Println(message)
}`,
    bash: `#!/bin/bash

for file in *.txt; do
    echo i18n.t('factory.chat.processingFile', 'Processing $file')
    wc -l "$file"
done`,
  };

  const hasFilename = faker.datatype.boolean({ probability: 0.5 });
  const extension = lang === 'typescript' ? 'ts' : lang;
  const filename = hasFilename ? `${faker.lorem.word()}.${extension}` : undefined;

  return {
    language: lang,
    code: codeSnippets[lang] ?? codeSnippets.typescript,
    filename,
  };
}

export function createFakeCodeBlocks(count: number): FakeCodeBlock[] {
  return Array.from({ length: count }, () => createFakeCodeBlock());
}

export interface FakePromptTemplate {
  category: string;
  description: string;
  id: string;
  name: string;
  template: string;
  variables: string[];
}

export function createFakePromptTemplate(): FakePromptTemplate {
  const templates = [
    {
      name: i18n.t('factory.chat.codeReview', 'Code Review'),
      description: i18n.t(
        'factory.chat.reviewCodeForBestPractices',
        'Review code for best practices and potential issues'
      ),
      template: i18n.t(
        'factory.chat.reviewTheFollowingLanguageCode',
        'Review the following {{language}} code and suggest improvements:\n\n{{code}}'
      ),
      variables: ['language', 'code'],
      category: i18n.t('factory.chat.development', 'Development'),
    },
    {
      name: i18n.t('factory.chat.explainConcept', 'Explain Concept'),
      description: i18n.t(
        'factory.chat.explainATechnicalConceptIn',
        'Explain a technical concept in simple terms'
      ),
      template: i18n.t(
        'factory.chat.explainConceptToSomeoneWith',
        'Explain {{concept}} to someone with {{expertise_level}} experience.'
      ),
      variables: ['concept', 'expertise_level'],
      category: i18n.t('factory.chat.education', 'Education'),
    },
    {
      name: i18n.t('factory.chat.writeDocumentation', 'Write Documentation'),
      description: i18n.t(
        'factory.chat.generateDocumentationForCode',
        'Generate documentation for code'
      ),
      template: i18n.t(
        'factory.chat.writeDocumentationForTheFollowing',
        'Write documentation for the following function:\n\n{{function}}'
      ),
      variables: ['function'],
      category: i18n.t('factory.chat.documentation', 'Documentation'),
    },
  ];

  const template = faker.helpers.arrayElement(templates);

  return {
    id: faker.string.uuid(),
    ...template,
  };
}

export function createFakePromptTemplates(count: number): FakePromptTemplate[] {
  return Array.from({ length: count }, () => createFakePromptTemplate());
}
