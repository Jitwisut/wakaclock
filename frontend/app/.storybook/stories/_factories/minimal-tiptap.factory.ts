import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Editor output format
 */
export type EditorOutputFormat = 'html' | 'json' | 'markdown' | 'text';

/**
 * Editor content type categories
 */
export type EditorContentType =
  | 'article'
  | 'bio'
  | 'blog-post'
  | 'code-documentation'
  | 'comment'
  | 'email'
  | 'note'
  | 'readme'
  | 'review';

/**
 * Text formatting types
 */
export type TextFormat = 'bold' | 'code' | 'highlight' | 'italic' | 'strikethrough' | 'underline';

/**
 * Block element types
 */
export type BlockType =
  | 'blockquote'
  | 'bullet-list'
  | 'code-block'
  | 'heading'
  | 'horizontal-rule'
  | 'image'
  | 'numbered-list'
  | 'paragraph'
  | 'table';

/**
 * Heading levels
 */
export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Editor toolbar group
 */
export type ToolbarGroup = 'alignment' | 'blocks' | 'formatting' | 'history' | 'insert' | 'lists';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * All output formats
 */
export const EDITOR_OUTPUT_FORMATS: EditorOutputFormat[] = ['html', 'json', 'markdown', 'text'];

/**
 * All content types
 */
export const EDITOR_CONTENT_TYPES: EditorContentType[] = [
  'article',
  'bio',
  'blog-post',
  'code-documentation',
  'comment',
  'email',
  'note',
  'readme',
  'review',
];

/**
 * All text formats
 */
export const TEXT_FORMATS: TextFormat[] = [
  'bold',
  'code',
  'highlight',
  'italic',
  'strikethrough',
  'underline',
];

/**
 * All block types
 */
export const BLOCK_TYPES: BlockType[] = [
  'blockquote',
  'bullet-list',
  'code-block',
  'heading',
  'horizontal-rule',
  'image',
  'numbered-list',
  'paragraph',
  'table',
];

/**
 * All heading levels
 */
export const HEADING_LEVELS: HeadingLevel[] = [1, 2, 3, 4, 5, 6];

/**
 * Toolbar groups
 */
export const TOOLBAR_GROUPS: ToolbarGroup[] = [
  'alignment',
  'blocks',
  'formatting',
  'history',
  'insert',
  'lists',
];

/**
 * Sample code snippets by language
 */
export const CODE_SNIPPETS: Record<string, string> = {
  css: `
.container {
  display: flex;
  justify-content: center;
  align-items: center;
}`.trim(),
  html: `
<div class="container">
  <h1>Hello World</h1>
  <p>Welcome to my website.</p>
</div>`.trim(),
  javascript: `
function greet(name) {
  return \`Hello, \${name}!\`;
}
console.log(greet('World'));`.trim(),
  json: `
{
  "name": "example",
  "version": "1.0.0",
  "dependencies": {}
}`.trim(),
  python: `
def greet(name):
    return f'Hello, {name}!'

print(greet('World'))`.trim(),
  typescript: `
interface User {
  id: string;
  name: string;
  email: string;
}

function createUser(data: Partial<User>): User {
  return { id: crypto.randomUUID(), ...data } as User;
}`.trim(),
};

/**
 * Programming languages for code blocks
 */
export const CODE_LANGUAGES = ['css', 'html', 'javascript', 'json', 'python', 'typescript'];

// =============================================================================
// INTERFACES
// =============================================================================

/**
 * Base editor content configuration
 */
export interface FakeEditorContent {
  characterCount: number;
  contentType: EditorContentType;
  html: string;
  id: string;
  plainText: string;
  wordCount: number;
}

/**
 * Editor configuration
 */
export interface FakeEditorConfig {
  autofocus: boolean;
  editable: boolean;
  id: string;
  maxLength?: number;
  minHeight: number;
  placeholder: string;
}

/**
 * Editor with content and config
 */
export interface FakeEditor extends FakeEditorConfig {
  content: FakeEditorContent;
}

/**
 * Rich text block element
 */
export interface FakeRichTextBlock {
  attributes?: Record<string, string>;
  children?: FakeRichTextBlock[];
  content?: string;
  html: string;
  type: BlockType;
}

/**
 * Editor labels for i18n
 */
export interface FakeEditorLabels {
  bold: string;
  bulletList: string;
  code: string;
  heading: string;
  italic: string;
  link: string;
  numberedList: string;
  placeholder: string;
  quote: string;
  redo: string;
  strikethrough: string;
  underline: string;
  undo: string;
}

/**
 * Blog post editor content
 */
export interface FakeBlogPostContent extends FakeEditorContent {
  author: string;
  category: string;
  excerpt: string;
  featuredImage?: string;
  publishDate: Date;
  tags: string[];
  title: string;
}

/**
 * Comment editor content
 */
export interface FakeCommentContent extends FakeEditorContent {
  author: string;
  createdAt: Date;
  parentId?: string;
  replyTo?: string;
}

/**
 * Documentation content
 */
export interface FakeDocumentationContent extends FakeEditorContent {
  codeExamples: string[];
  relatedLinks: Array<{ text: string; url: string }>;
  section: string;
  title: string;
  version: string;
}

/**
 * Email content
 */
export interface FakeEmailContent extends FakeEditorContent {
  bcc?: string[];
  cc?: string[];
  from: string;
  subject: string;
  to: string[];
}

/**
 * Note content
 */
export interface FakeNoteContent extends FakeEditorContent {
  color?: string;
  createdAt: Date;
  isPinned: boolean;
  title: string;
  updatedAt: Date;
}

/**
 * Editor toolbar configuration
 */
export interface FakeToolbarConfig {
  enabledGroups: ToolbarGroup[];
  id: string;
  position: 'bottom' | 'floating' | 'top';
  showLabels: boolean;
}

/**
 * Editor showcase collection
 */
export interface FakeEditorShowcase {
  blogPosts: FakeBlogPostContent[];
  comments: FakeCommentContent[];
  documentation: FakeDocumentationContent[];
  emails: FakeEmailContent[];
  notes: FakeNoteContent[];
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Wrap text in HTML tag
 */
function wrapInTag(text: string, tag: string, attributes?: Record<string, string>): string {
  const attrs = attributes
    ? ` ${Object.entries(attributes)
        .map(([k, v]) => `${k}="${v}"`)
        .join(' ')}`
    : '';
  return `<${tag}${attrs}>${text}</${tag}>`;
}

/**
 * Create HTML paragraph
 */
function createParagraph(text: string): string {
  return wrapInTag(text, 'p');
}

/**
 * Create HTML heading
 */
function createHeading(text: string, level: HeadingLevel = 2): string {
  return wrapInTag(text, `h${level}`);
}

/**
 * Create HTML list
 */
function createList(items: string[], ordered: boolean = false): string {
  const listItems = items.map((item) => wrapInTag(item, 'li')).join('');
  return wrapInTag(listItems, ordered ? 'ol' : 'ul');
}

/**
 * Create HTML blockquote
 */
function createBlockquote(text: string): string {
  return wrapInTag(createParagraph(text), 'blockquote');
}

/**
 * Create HTML code block
 */
function createCodeBlock(code: string, language?: string): string {
  const codeTag = wrapInTag(code, 'code', language ? { class: `language-${language}` } : {});
  return wrapInTag(codeTag, 'pre');
}

/**
 * Create HTML link
 */
function createLink(text: string, url: string): string {
  return wrapInTag(text, 'a', { href: url });
}

/**
 * Calculate word count from HTML
 */
function countWords(html: string): number {
  const text = html
    .replaceAll(/<\/?[a-z][^>]*>/gi, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
  return text ? text.split(' ').length : 0;
}

/**
 * Calculate character count from HTML
 */
function countCharacters(html: string): number {
  return html.replaceAll(/<\/?[a-z][^>]*>/gi, '').length;
}

/**
 * Extract plain text from HTML
 */
function extractPlainText(html: string): string {
  return html
    .replaceAll(/<\/?[a-z][^>]*>/gi, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

// =============================================================================
// FACTORY FUNCTIONS - Basic Content
// =============================================================================

/**
 * Create basic editor content
 */
export function createFakeEditorContent(overrides?: Partial<FakeEditorContent>): FakeEditorContent {
  const paragraphs = faker.number.int({ max: 5, min: 1 });
  const html = Array.from({ length: paragraphs }, () =>
    createParagraph(faker.lorem.paragraph())
  ).join('');

  return {
    characterCount: countCharacters(html),
    contentType: faker.helpers.arrayElement(EDITOR_CONTENT_TYPES),
    html,
    id: faker.string.uuid(),
    plainText: extractPlainText(html),
    wordCount: countWords(html),
    ...overrides,
  };
}

/**
 * Create multiple editor contents
 */
export function createFakeEditorContents(count: number): FakeEditorContent[] {
  return Array.from({ length: count }, () => createFakeEditorContent());
}

/**
 * Create editor config
 */
export function createFakeEditorConfig(overrides?: Partial<FakeEditorConfig>): FakeEditorConfig {
  return {
    autofocus: faker.datatype.boolean({ probability: 0.3 }),
    editable: faker.datatype.boolean({ probability: 0.9 }),
    id: faker.string.uuid(),
    maxLength: faker.helpers.maybe(() => faker.number.int({ max: 10_000, min: 500 }), {
      probability: 0.2,
    }),
    minHeight: faker.helpers.arrayElement([100, 150, 200, 300]),
    placeholder: faker.helpers.arrayElement([
      i18n.t('factory.minimalTiptap.writeSomething', 'Write something...'),
      i18n.t('factory.minimalTiptap.startTyping', 'Start typing...'),
      i18n.t('factory.minimalTiptap.enterYourTextHere', 'Enter your text here...'),
      i18n.t('factory.minimalTiptap.whatsOnYourMind', "What's on your mind?"),
      i18n.t('factory.minimalTiptap.addYourContent', 'Add your content...'),
    ]),
    ...overrides,
  };
}

/**
 * Create a complete editor with content and config
 */
export function createFakeEditor(overrides?: Partial<FakeEditor>): FakeEditor {
  const config = createFakeEditorConfig();
  const content = createFakeEditorContent();

  return {
    ...config,
    content,
    ...overrides,
  };
}

// =============================================================================
// FACTORY FUNCTIONS - Rich Content
// =============================================================================

/**
 * Create rich text content with various elements
 */
export function createFakeRichContent(): FakeEditorContent {
  const parts: string[] = [];

  // Add heading
  parts.push(createHeading(faker.lorem.sentence({ max: 6, min: 3 }), 2));

  // Add paragraphs with formatting
  parts.push(
    createParagraph(
      `${faker.lorem.sentence()} <strong>${faker.lorem.words(3)}</strong> ${faker.lorem.sentence()}`
    )
  );

  // Add a list
  const listItems = Array.from({ length: faker.number.int({ max: 5, min: 3 }) }, () =>
    faker.lorem.sentence()
  );
  parts.push(createList(listItems));

  // Add blockquote
  parts.push(createBlockquote(faker.lorem.paragraph()));

  // Add another paragraph with link
  const linkText = faker.lorem.words(2);
  const linkUrl = faker.internet.url();
  parts.push(
    createParagraph(
      `${faker.lorem.sentence()} ${createLink(linkText, linkUrl)} ${faker.lorem.sentence()}`
    )
  );

  const html = parts.join('\n');

  return {
    characterCount: countCharacters(html),
    contentType: 'article',
    html,
    id: faker.string.uuid(),
    plainText: extractPlainText(html),
    wordCount: countWords(html),
  };
}

/**
 * Create content with code examples
 */
export function createFakeCodeContent(language?: string): FakeEditorContent {
  const lang = language || faker.helpers.arrayElement(CODE_LANGUAGES);
  const code = CODE_SNIPPETS[lang] || CODE_SNIPPETS.javascript;

  const parts: string[] = [
    createHeading(
      i18n.t('factory.minimalTiptap.languageExample', '{{language}} Example', {
        language: lang.charAt(0).toUpperCase() + lang.slice(1),
      }),
      2
    ),
    createParagraph(faker.lorem.paragraph()),
    createCodeBlock(code, lang),
    createParagraph(faker.lorem.paragraph()),
  ];

  const html = parts.join('\n');

  return {
    characterCount: countCharacters(html),
    contentType: 'code-documentation',
    html,
    id: faker.string.uuid(),
    plainText: extractPlainText(html),
    wordCount: countWords(html),
  };
}

// =============================================================================
// FACTORY FUNCTIONS - Specialized Content Types
// =============================================================================

/**
 * Create blog post content
 */
export function createFakeBlogPostContent(
  overrides?: Partial<FakeBlogPostContent>
): FakeBlogPostContent {
  const title = faker.lorem.sentence({ max: 10, min: 5 });
  const parts: string[] = [
    createHeading(title, 1),
    createParagraph(`<em>${faker.lorem.paragraph()}</em>`),
  ];

  // Add sections
  for (let i = 0; i < faker.number.int({ max: 4, min: 2 }); i++) {
    parts.push(createHeading(faker.lorem.sentence({ max: 6, min: 3 }), 2));
    parts.push(createParagraph(faker.lorem.paragraphs(2)));
  }

  const html = parts.join('\n');

  return {
    author: faker.person.fullName(),
    category: faker.helpers.arrayElement([
      i18n.t('factory.minimalTiptap.technology', 'Technology'),
      i18n.t('factory.minimalTiptap.business', 'Business'),
      i18n.t('factory.minimalTiptap.design', 'Design'),
      i18n.t('factory.minimalTiptap.development', 'Development'),
      i18n.t('factory.minimalTiptap.tutorial', 'Tutorial'),
    ]),
    characterCount: countCharacters(html),
    contentType: 'blog-post',
    excerpt: faker.lorem.paragraph(),
    featuredImage: faker.helpers.maybe(() => faker.image.url(), { probability: 0.7 }),
    html,
    id: faker.string.uuid(),
    plainText: extractPlainText(html),
    publishDate: faker.date.recent({ days: 30 }),
    tags: faker.helpers.arrayElements(
      ['react', 'typescript', 'nextjs', 'css', 'web-development', 'tutorial'],
      { max: 4, min: 2 }
    ),
    title,
    wordCount: countWords(html),
    ...overrides,
  };
}

/**
 * Create multiple blog posts
 */
export function createFakeBlogPosts(count: number): FakeBlogPostContent[] {
  return Array.from({ length: count }, () => createFakeBlogPostContent());
}

/**
 * Create comment content
 */
export function createFakeCommentContent(
  overrides?: Partial<FakeCommentContent>
): FakeCommentContent {
  const paragraphs = faker.number.int({ max: 2, min: 1 });
  const html = Array.from({ length: paragraphs }, () =>
    createParagraph(faker.lorem.paragraph())
  ).join('');

  return {
    author: faker.person.fullName(),
    characterCount: countCharacters(html),
    contentType: 'comment',
    createdAt: faker.date.recent({ days: 7 }),
    html,
    id: faker.string.uuid(),
    parentId: faker.helpers.maybe(() => faker.string.uuid(), { probability: 0.3 }),
    plainText: extractPlainText(html),
    replyTo: faker.helpers.maybe(() => faker.person.firstName(), { probability: 0.3 }),
    wordCount: countWords(html),
    ...overrides,
  };
}

/**
 * Create multiple comments
 */
export function createFakeComments(count: number): FakeCommentContent[] {
  return Array.from({ length: count }, () => createFakeCommentContent());
}

/**
 * Create documentation content
 */
export function createFakeDocumentationContent(
  overrides?: Partial<FakeDocumentationContent>
): FakeDocumentationContent {
  const title = faker.helpers.arrayElement([
    i18n.t('factory.minimalTiptap.gettingStarted', 'Getting Started'),
    i18n.t('factory.minimalTiptap.installation', 'Installation'),
    i18n.t('factory.minimalTiptap.configuration', 'Configuration'),
    i18n.t('factory.minimalTiptap.apiReference', 'API Reference'),
    i18n.t('factory.minimalTiptap.examples', 'Examples'),
    i18n.t('factory.minimalTiptap.troubleshooting', 'Troubleshooting'),
  ]);

  const parts: string[] = [
    createHeading(title, 1),
    createParagraph(faker.lorem.paragraph()),
    createHeading(i18n.t('factory.minimalTiptap.overview', 'Overview'), 2),
    createParagraph(faker.lorem.paragraphs(2)),
  ];

  // Add code example
  const language = faker.helpers.arrayElement(['javascript', 'typescript']);
  parts.push(createHeading(i18n.t('factory.minimalTiptap.example', 'Example'), 2));
  parts.push(createCodeBlock(CODE_SNIPPETS[language], language));

  const html = parts.join('\n');

  return {
    characterCount: countCharacters(html),
    codeExamples: [CODE_SNIPPETS[language]],
    contentType: 'code-documentation',
    html,
    id: faker.string.uuid(),
    plainText: extractPlainText(html),
    relatedLinks: Array.from({ length: faker.number.int({ max: 4, min: 1 }) }, () => ({
      text: faker.lorem.words(3),
      url: faker.internet.url(),
    })),
    section: faker.helpers.arrayElement(['guides', 'api', 'tutorials', 'reference']),
    title,
    version: faker.system.semver(),
    wordCount: countWords(html),
    ...overrides,
  };
}

/**
 * Create email content
 */
export function createFakeEmailContent(overrides?: Partial<FakeEmailContent>): FakeEmailContent {
  const subject = faker.lorem.sentence({ max: 8, min: 4 });
  const greeting = `<p>${i18n.t('factory.minimalTiptap.hiName', 'Hi {{name}},', { name: faker.person.firstName() })}</p>`;
  const body = Array.from({ length: faker.number.int({ max: 3, min: 1 }) }, () =>
    createParagraph(faker.lorem.paragraph())
  ).join('');
  const signature = `<p>${i18n.t('factory.minimalTiptap.bestRegards', 'Best regards,')}<br/>${faker.person.fullName()}</p>`;
  const html = greeting + body + signature;

  return {
    bcc: faker.helpers.maybe(
      () =>
        Array.from({ length: faker.number.int({ max: 2, min: 1 }) }, () => faker.internet.email()),
      { probability: 0.1 }
    ),
    cc: faker.helpers.maybe(
      () =>
        Array.from({ length: faker.number.int({ max: 3, min: 1 }) }, () => faker.internet.email()),
      { probability: 0.2 }
    ),
    characterCount: countCharacters(html),
    contentType: 'email',
    from: faker.internet.email(),
    html,
    id: faker.string.uuid(),
    plainText: extractPlainText(html),
    subject,
    to: Array.from({ length: faker.number.int({ max: 3, min: 1 }) }, () => faker.internet.email()),
    wordCount: countWords(html),
    ...overrides,
  };
}

/**
 * Create note content
 */
export function createFakeNoteContent(overrides?: Partial<FakeNoteContent>): FakeNoteContent {
  const title = faker.lorem.sentence({ max: 6, min: 2 });
  const parts: string[] = [
    createHeading(title, 2),
    ...Array.from({ length: faker.number.int({ max: 3, min: 1 }) }, () =>
      createParagraph(faker.lorem.paragraph())
    ),
  ];

  // Maybe add a list
  if (faker.datatype.boolean({ probability: 0.5 })) {
    parts.push(
      createList(
        Array.from({ length: faker.number.int({ max: 5, min: 2 }) }, () => faker.lorem.sentence())
      )
    );
  }

  const html = parts.join('\n');
  const createdAt = faker.date.past({ years: 1 });

  return {
    characterCount: countCharacters(html),
    color: faker.helpers.maybe(
      () => faker.helpers.arrayElement(['yellow', 'blue', 'green', 'pink', 'purple']),
      { probability: 0.4 }
    ),
    contentType: 'note',
    createdAt,
    html,
    id: faker.string.uuid(),
    isPinned: faker.datatype.boolean({ probability: 0.2 }),
    plainText: extractPlainText(html),
    title,
    updatedAt: faker.date.between({ from: createdAt, to: new Date() }),
    wordCount: countWords(html),
    ...overrides,
  };
}

/**
 * Create multiple notes
 */
export function createFakeNotes(count: number): FakeNoteContent[] {
  return Array.from({ length: count }, () => createFakeNoteContent());
}

// =============================================================================
// FACTORY FUNCTIONS - Editor Labels (i18n)
// =============================================================================

/**
 * Create editor labels in English
 */
export function createFakeEditorLabelsEn(): FakeEditorLabels {
  return {
    bold: i18n.t('factory.minimalTiptap.bold', 'Bold'),
    bulletList: i18n.t('factory.minimalTiptap.bulletList', 'Bullet List'),
    code: i18n.t('factory.minimalTiptap.code', 'Code'),
    heading: i18n.t('factory.minimalTiptap.heading', 'Heading'),
    italic: i18n.t('factory.minimalTiptap.italic', 'Italic'),
    link: i18n.t('factory.minimalTiptap.link', 'Link'),
    numberedList: i18n.t('factory.minimalTiptap.numberedList', 'Numbered List'),
    placeholder: i18n.t('factory.minimalTiptap.writeSomething', 'Write something...'),
    quote: i18n.t('factory.minimalTiptap.quote', 'Quote'),
    redo: i18n.t('factory.minimalTiptap.redo', 'Redo'),
    strikethrough: i18n.t('factory.minimalTiptap.strikethrough', 'Strikethrough'),
    underline: i18n.t('factory.minimalTiptap.underline', 'Underline'),
    undo: i18n.t('factory.minimalTiptap.undo', 'Undo'),
  };
}

/**
 * Create editor labels in Japanese
 */
export function createFakeEditorLabelsJa(): FakeEditorLabels {
  return {
    bold: '太字',
    bulletList: '箇条書き',
    code: 'コード',
    heading: '見出し',
    italic: '斜体',
    link: 'リンク',
    numberedList: '番号付きリスト',
    placeholder: '入力してください...',
    quote: '引用',
    redo: 'やり直し',
    strikethrough: '取り消し線',
    underline: '下線',
    undo: '元に戻す',
  };
}

// =============================================================================
// FACTORY FUNCTIONS - Toolbar
// =============================================================================

/**
 * Create toolbar configuration
 */
export function createFakeToolbarConfig(overrides?: Partial<FakeToolbarConfig>): FakeToolbarConfig {
  return {
    enabledGroups: faker.helpers.arrayElements(TOOLBAR_GROUPS, {
      max: TOOLBAR_GROUPS.length,
      min: 3,
    }),
    id: faker.string.uuid(),
    position: faker.helpers.arrayElement(['bottom', 'floating', 'top']),
    showLabels: faker.datatype.boolean({ probability: 0.3 }),
    ...overrides,
  };
}

// =============================================================================
// FACTORY FUNCTIONS - Showcase
// =============================================================================

/**
 * Create a comprehensive editor showcase
 */
export function createFakeEditorShowcase(): FakeEditorShowcase {
  return {
    blogPosts: createFakeBlogPosts(3),
    comments: createFakeComments(5),
    documentation: Array.from({ length: 2 }, () => createFakeDocumentationContent()),
    emails: Array.from({ length: 2 }, () => createFakeEmailContent()),
    notes: createFakeNotes(4),
  };
}

// =============================================================================
// FACTORY FUNCTIONS - Specific Use Cases
// =============================================================================

/**
 * Create empty editor placeholder content
 */
export function createFakeEmptyEditorContent(): FakeEditorContent {
  return createFakeEditorContent({
    characterCount: 0,
    html: '',
    plainText: '',
    wordCount: 0,
  });
}

/**
 * Create minimal editor content (single paragraph)
 */
export function createFakeMinimalContent(): FakeEditorContent {
  const html = createParagraph(faker.lorem.sentence());
  return createFakeEditorContent({
    characterCount: countCharacters(html),
    html,
    plainText: extractPlainText(html),
    wordCount: countWords(html),
  });
}

/**
 * Create read-only content display
 */
export function createFakeReadOnlyEditor(): FakeEditor {
  return createFakeEditor({
    content: createFakeRichContent(),
    editable: false,
    placeholder: '',
  });
}

/**
 * Create editor for chat message
 */
export function createFakeChatMessageEditor(): FakeEditor {
  return createFakeEditor({
    autofocus: true,
    maxLength: 2000,
    minHeight: 80,
    placeholder: i18n.t('factory.minimalTiptap.typeAMessage', 'Type a message...'),
  });
}

/**
 * Create editor for social media post
 */
export function createFakeSocialPostEditor(): FakeEditor {
  return createFakeEditor({
    maxLength: 280,
    minHeight: 100,
    placeholder: i18n.t('factory.minimalTiptap.whatsHappening', "What's happening?"),
  });
}

/**
 * Create editor with long-form content
 */
export function createFakeLongFormEditor(): FakeEditor {
  const content = createFakeBlogPostContent();
  return createFakeEditor({
    content,
    minHeight: 400,
    placeholder: i18n.t(
      'factory.minimalTiptap.startWritingYourArticle',
      'Start writing your article...'
    ),
  });
}
