import * as assert from 'assert';
import { defaultLog } from 'src/base/common/logger';
import { MarkdownLexer } from 'src/editor/model/markdownLexer';
import { DocumentNodeProvider } from 'src/editor/model/documentNode/documentNodeProvider';
import { DocumentParser } from 'src/editor/model/parser';
import { buildSchema } from 'src/editor/model/schema';
import { IncrementalDelimiter, MarkdownSerializer } from 'src/editor/model/serializer';
import { ConsoleLogger } from 'src/platform/logger/common/consoleLoggerService';
import { createIntegration } from 'test/utils/integration';

suite('MarkdownSerializer', async () => {
    
    const di = await createIntegration({ 
        i18nService: true 
    });
    const nodeProvider = DocumentNodeProvider.create(di).register();
    const schema = buildSchema(nodeProvider);
    const lexer = new MarkdownLexer({});
    const docParser = new DocumentParser(schema, nodeProvider, /* options */);
    const serializer = new MarkdownSerializer(nodeProvider, { strict: true, escapeExtraCharacters: undefined, });
    docParser.onLog(e => defaultLog(new ConsoleLogger(), e.level, 'serializer.test.ts', e.message, e.error, e.additional));

    /**
     * @description Expecting the serialized output is exactly the same as the 
     * input.
     */
    function expectSame(content: string): void {
        expectSameTo(content, content);
    }

    function expectSameTo(content: string, expect: string): void {
        const serializedContent = parseAndSerialize(content);

        // console.log('[input ]', Strings.escape(content));
        // console.log('[expect]', `(${Strings.escape(expect)})`);
        // console.log('[actual]', `(${Strings.escape(serializedContent)})`);

        assert.strictEqual(expect, serializedContent);
    }

    function parseAndSerialize(content: string): string {
        const tokens = lexer.lex(content);
        const doc = docParser.parse(tokens);
        const serializedContent = serializer.serialize(doc);
        return serializedContent;
    }

    suite('IncrementalDelimiter', () => {
        suite('constructor', () => {
            test('should use the provided default delimiter', () => {
                const manager = new IncrementalDelimiter('*');
                assert.strictEqual(manager.getDelimiter(), '*');
            });
    
            test('should default to an empty string if no default is provided', () => {
                const manager = new IncrementalDelimiter(null);
                assert.strictEqual(manager.getDelimiter(), '');
            });
        });
        
        suite('getDelimiter', () => {
            test('should return default delimiter if no increments are set', () => {
                const manager = new IncrementalDelimiter('>');
                assert.strictEqual(manager.getDelimiter(), '>');
            });
    
            test('should return updated delimiter after increments are set', () => {
                const manager = new IncrementalDelimiter('>');
                manager.setIncrement([' ', '  ']);
                assert.strictEqual(manager.getDelimiter(), '> ');
                assert.strictEqual(manager.getDelimiter(), '>  ');
            });
    
            test('should return default delimiter if all increments are used', () => {
                const manager = new IncrementalDelimiter('>');
                manager.setIncrement([' ', '  ']);
                manager.getDelimiter(); // Use increment
                manager.getDelimiter(); // Use increment
                assert.strictEqual(manager.getDelimiter(), '>');
            });
        });
    
        suite('setIncrement', () => {
            test('should set increments when called for the first time', () => {
                const manager = new IncrementalDelimiter('>');
                manager.setIncrement([' ', '  ']);
                assert.strictEqual(manager.getDelimiter(), '> ');
                assert.strictEqual(manager.getDelimiter(), '>  ');
            });
    
            test('should append new increments to existing ones', () => {
                const manager = new IncrementalDelimiter('>');
                manager.setIncrement([' ', '  ']);
                manager.setIncrement(['>', '>']);
                assert.strictEqual(manager.getDelimiter(), '> >');
                assert.strictEqual(manager.getDelimiter(), '>  >');
            });
    
            test('should handle empty increments properly', () => {
                const manager = new IncrementalDelimiter('>');
                manager.setIncrement([]);
                assert.strictEqual(manager.getDelimiter(), '>');
            });
    
            test('should append new increments when exceeds the current length', () => {
                const manager = new IncrementalDelimiter('');
                manager.setIncrement([' ', '  ']);
                manager.setIncrement(['>', '>']);
                manager.setIncrement(['|', '|', '|']);
                assert.strictEqual(manager.getDelimiter(), ' >|');
                assert.strictEqual(manager.getDelimiter(), '  >|');
                assert.strictEqual(manager.getDelimiter(), '|');
            });
        });
    });

    suite('corner case: preserveLastEndOfLine', () => {
        test('Paragraph - With new line at the end', () => {
            expectSame('paragraph1\n');
        });
        
        test('Paragraph - With space and new line at the end', () => {
            expectSame('paragraph1   \n');
        });

        test('Paragraph - Line break at both start and end', () => {
            expectSame('  \nLine with breaks around  \n');
        });

        test('Heading - With new line at the end', () => {
            expectSame('# Heading\n');
        });

        test('Blockquote - with multiple blockquote levels and leading spaces 2', () => {
            expectSame('   > Blockquote level 1.\n   >> Blockquote level 2.\n   >>> Blockquote level 3.\n');
        });

        test.skip('Blockquote - with multiple blockquote levels and leading spaces 2', () => {
            expectSame('   > Blockquote level 1.\n   >> Blockquote level 2.\n   >>> Blockquote level 3.\n with ending text');
        });

        test('Paragraph and Blockquote - only the last token with end of line at the end should be preserved', () => {
            expectSame('paragraph1\n> blockquote1\n');
        });

        test('horizontalRule - with new line at the end', () => {
            expectSame('---\n');
        });

        test('codeBlock - with new line at the end', () => {
            expectSame('```ts\nconsole.log("hello world");```\n');
        });
        
        test('codeBlock - with new line at the end 2', () => {
            expectSame('```ts\nconsole.log("hello world");```\n with ending text');
        });
        
        test.skip('list - with new line at the end', () => {
            expectSame('* list item\n');
        });
    });

    suite('block-level', () => {
        suite('Paragraph & Text', () => {
            test('Single paragraph', () => {
                expectSame('Some paragraph.');
            });
            
            test('Multi-line paragraph', () => {
                expectSame('This is a multi-line paragraph.\nIt has two lines.');
            });
            
            test('Backslash escape', () => {
                expectSame('\\');
            });
            
            test('Backslash followed by semicolon', () => {
                expectSame('\\;');
            });
            
            test('Special characters', () => {
                expectSame('!@#$%^&*()_+~=-[]{}\\|;:\'"<,>.?/');
            });
            
            test('Multiple spaces between words', () => {
                expectSame('This   is   text   with   multiple   spaces.');
            });
            
            test('Leading spaces', () => {
                expectSame('   This line has leading spaces.');
            });
            
            test('Trailing spaces', () => {
                expectSame('This line has trailing spaces.   ');
            });
    
            test('Leading and trailing spaces', () => {
                expectSame('   This line has both leading and trailing spaces.   ');
            });
    
            test('Empty paragraph', () => {
                expectSame('');
            });
    
            test('Single letter', () => {
                expectSame('A');
            });
    
            test('Special unicode characters', () => {
                expectSame('This paragraph contains unicode: 😊, 你, ü.');
            });
    
            test('Numbers', () => {
                expectSame('This is a paragraph with numbers 1234567890.');
            });
    
            test('Numbers and special characters', () => {
                expectSame('Numbers 1234, special characters: @#$%&*().');
            });
    
            test('Single word paragraph', () => {
                expectSame('Word');
            });
    
            test('Paragraph with single space', () => {
                expectSame(' ');
            });
    
            test('Mix of spaces and tabs', () => {
                expectSame('This paragraph has \t mixed spaces and tabs.');
            });
        });
    
        suite('Heading', () => {
            test('Level 1 - 6', () => {
                expectSame('# Heading 1');
                expectSame('## Heading 2');
                expectSame('### Heading 3');
                expectSame('#### Heading 4');
                expectSame('##### Heading 5');
                expectSame('###### Heading 6');
            });
        
            test('With spaces before and after', () => {
                expectSameTo('  ## Heading with spaces   ', '## Heading with spaces');
            });
        
            test('With special characters', () => {
                expectSame('### Heading with punctuation !@#$%^&*()');
            });
        
            test('With bold and italic', () => {
                expectSame('### **Bold Heading**');
                expectSame('### *Italic Heading*');
            });

            test('With links', () => {
                expectSame('### [Link Heading](https://example.com)');
            });
        
            test('Mixed formatting', () => {
                expectSame('### **Bold** and *Italic* and [Link](https://example.com)');
            });
        
            test('Invalid heading (too few hash marks)', () => {
                expectSame('##InvalidHeading'); // Missing space, so it should not be treated as a heading
            });
        
            test('Invalid heading (too many hash marks)', () => {
                expectSame('####### Invalid Heading'); // Markdown supports up to H6, so this should not be treated as a heading
            });
        
            test('Heading with newline in content', () => {
                expectSame('## Heading with\nNewline'); // Newline in heading content
            });
        
            test('Heading with leading spaces after hash marks', () => {
                expectSameTo('##    Heading with leading spaces', '## Heading with leading spaces'); // Leading spaces should be removed
            });
        
            test('Heading with multiple spaces between words', () => {
                expectSame('## Heading   with   multiple   spaces');
            });
        
            test('Heading with escape characters', () => {
                expectSame('### Heading with \\*escaped\\* characters');
            });
        
            test('Heading with code span', () => {
                expectSame('### Heading with `code` span');
            });
        
            test('Heading with mixed formatting and escape', () => {
                expectSame('### **Bold** and *Italic* with \\*escaped\\* text and [Link](https://example.com)');
            });
        
            test('Heading with excessive hash marks', () => {
                expectSame('######## Excessive hash marks'); // Only up to 6 hashes should create a heading
            });
        
            test('Heading with no content after hash marks', () => {
                expectSame('### '); // Empty heading content should be allowed
            });
        
            test('Heading with trailing spaces', () => {
                expectSameTo('## Heading with trailing spaces   ', '## Heading with trailing spaces');
            });
    
            test('Heading with HTML tags', () => {
                expectSame('## Heading with <b>HTML</b> tags');
            });
        
            test('Heading with mixed Markdown and HTML', () => {
                expectSame('### **Bold** and <em>HTML Italic</em> in heading');
            });
        
            test('Heading with tab characters', () => {
                expectSame('## Heading\twith\ttabs'); // Tabs should be preserved in heading content
            });
        
            test('Heading with inline image', () => {
                expectSame('### Heading with ![alt text](image.jpg)');
            });
        
            test('Heading with an empty line after the hash marks', () => {
                expectSame('## \nHeading with newline after hash marks'); // Content should not be treated as part of the heading
            });

            // FIX: see https://github.com/markedjs/marked/issues/3513
            test.skip('Heading with two line breaks', () => {
                expectSame('# Heading\n\n');
            });
        });
    
        suite('html', () => {
            test('Basic empty div', () => {
                expectSame('<div></div>');
            });
    
            test('Single hr', () => {
                expectSame('<br>');
            });
    
            test('Div with text content', () => {
                expectSame('<div>hello world</div>');
            });
            
            test('Div with a new line at the end', () => {
                expectSame('<div>hello world</div>\n');
            });
    
            test('Div with style attributes and markdown (not parsed)', () => {
                expectSame('<div style=\'font-family: "Comic Sans MS", "Comic Sans", cursive;\'>It is a pity, but markdown does **not** work in here for most markdown parsers.[Marked] handles it pretty well.</div>');
            });
    
            test('Iframe with various attributes', () => {
                expectSame('<iframe style="border-radius:12px" src="https://open.spotify.com/embed/track/1r5SJvZE3c3LOLRJr3ZYtc?utm_source=generator" width="100%" height="352" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>');
            });
    
            test('Self-closing tag (img)', () => {
                expectSame('<img src="image.jpg" alt="Sample image" />');
            });
        
            test('Nested elements', () => {
                expectSame('<div><span>Nested content <strong>inside</strong> div.</span></div>');
            });
        
            test('HTML comments', () => {
                expectSame('<!-- This is a comment -->\n<div>Content after comment</div>');
            });
        
            test('Doctype declaration', () => {
                expectSame('<!DOCTYPE html>\n<html>\n<body>\n<div>Hello World</div>\n</body>\n</html>');
            });
        
            test('Script tag', () => {
                expectSame('<script>alert("This is a script!");</script>');
            });
        
            test('Pre tag with code block', () => {
                expectSame('<pre><code>let x = 10;\nconsole.log(x);</code></pre>');
            });
        
            test('Special characters in attributes', () => {
                expectSame('<a href="https://example.com/?query=hello&amp;world"/>');
            });
        
            test('Invalid or unknown tags', () => {
                expectSame('<foo>Invalid tag</foo>');
            });
        
            test('Mixed case tag names', () => {
                expectSame('<Div>Hello World</Div>');
            });
        
            test('Custom data attributes', () => {
                expectSame('<div data-custom="123">Custom attribute content</div>');
            });
        
            test('Boolean attributes', () => {
                expectSame('<input type="checkbox" checked>');
            });
        
            test('Deeply nested elements', () => {
                expectSame('<div><ul><li><a href="#">Nested link inside list item</a></li></ul></div>');
            });
        
            test('Inline styles', () => {
                expectSame('<p style="color: red; font-size: 14px;">Styled paragraph</p>');
            });
        
            test('Broken unclosed tag', () => {
                expectSame('<div><p>Unclosed tag');
            });
        
            test('Entities', () => {
                expectSame('<p>Some special characters: &amp;, &lt;, &gt;, &quot;</p>');
            });
        
            test('Unicode characters', () => {
                expectSame('<div>Unicode: 😊, 你好, ü</div>');
            });
        });
    
        suite('inline_html', () => {
            test('Basic inline HTML - <em>', () => {
                expectSame('This is <em>emphasized</em> text.');
            });
    
            test('Basic inline HTML - <strong>', () => {
                expectSame('This is <strong>bold</strong> text.');
            });
    
            test('Inline HTML with attributes - <a>', () => {
                expectSame('Click <a href="https://example.com">here</a> for more information.');
            });
    
            test('Self-closing inline HTML tag - <img>', () => {
                expectSame('This is an image <img src="image.jpg" alt="Image description"/> inline.');
            });
    
            test('Inline HTML with multiple attributes', () => {
                expectSame('Click <a href="https://example.com" target="_blank">here</a> for more information.');
            });
    
            test('Inline HTML with special characters', () => {
                expectSame('This is <span title="&quot;Special&quot;">special</span> text.');
            });
    
            test('Mixed Markdown and inline HTML', () => {
                expectSame('This is *italic* and <strong>bold</strong> text with a [link](https://example.com).');
            });
    
            test('Nested inline HTML elements', () => {
                expectSame('This is <em><strong>nested</strong></em> inline HTML.');
            });
    
            test('Empty inline HTML tag', () => {
                expectSame('This is an empty inline tag: <br>.');
            });
    
            test('Invalid inline HTML tag', () => {
                expectSame('This is invalid <invalidTag>inline HTML</invalidTag>.');
            });
    
            test('Inline HTML with mismatched tags', () => {
                expectSame('This is <em>mismatched</strong> inline HTML tags.');
            });
    
            test('Inline HTML with incomplete tag', () => {
                expectSame('This is an incomplete tag: <em>');
            });
            
            test('Inline HTML with multiple incomplete tag', () => {
                expectSame('This is an incomplete tag: <em><strong><DiV>...');
            });
    
            test('Inline HTML tag with spaces', () => {
                expectSame('This is <em> emphasized text </em> with spaces around.');
            });
    
            test('Inline HTML tag with missing closing angle bracket', () => {
                expectSame('This is a tag with missing closing angle bracket: <em');
            });
    
            test('Inline HTML with multiple consecutive tags', () => {
                expectSame('This is <em>first</em><strong>second</strong> inline HTML.');
            });
    
            test('Inline HTML tag with content spanning multiple lines', () => {
                expectSame('This is <em>multi-line\ncontent</em> inside an inline HTML tag.');
            });
    
            // FIX: should work after 'marked' update
            test.skip('Inline HTML inside a code span', () => {
                expectSame('This is a code span with inline HTML: `<em>code</em>`.');
            });
    
            test('Inline HTML with escape sequences', () => {
                expectSame('This is inline HTML with escape sequences: &lt;em&gt;escaped&lt;/em&gt;.');
            });
    
            test('Self-closing inline tag with attribute', () => {
                expectSame('This is an image with title: <img src="image.jpg" title="Image"/>.');
            });
    
            test('Inline HTML tag within a heading', () => {
                expectSame('# Heading with <em>inline</em> HTML');
            });
            
            test('Inline HTML with no space between tags', () => {
                expectSame('This is <em>emphasized</em><strong>bold</strong> with no space.');
            });
        });
    
        suite('Image', () => {
            test('Empty image syntax', () => {
                expectSame('![]()');
            });
        
            test('URL without alt text', () => {
                expectSame('![](image.jpg)');
            });
        
            test('Alt text without URL', () => {
                expectSame('![alt text]()');
            });
        
            test('Alt text and URL', () => {
                expectSame('![alt text](image.jpg)');
            });
        
            test('Alt text, URL, and title', () => {
                expectSame('![alt text](image.jpg "Image Title")');
            });
        
            test('URL with encoded spaces', () => {
                expectSame('![alt text](image%20with%20spaces.jpg)');
            });
        
            test('Title with parentheses', () => {
                expectSame('![alt text](image.jpg "Title with (parentheses)")');
            });
        
            test('URL with parentheses', () => {
                expectSameTo('![alt text](image(with_parentheses).jpg)', '![alt text](image\\(with_parentheses\\).jpg)');
            });
        
            test('Special characters in URL', () => {
                expectSame('![alt text](image@#$%.jpg)');
            });
        
            test('Special characters in alt text', () => {
                expectSame('![alt@#$%](image.jpg)');
            });
        
            // FIX: should work after 'marked' update
            test.skip('Special characters in title', () => {
                expectSame('![alt text](image.jpg "Title with @#$%&*")');
            });
        
            test('Escaped characters in URL', () => {
                expectSame('![alt text](image\\(escaped\\).jpg)');
            });
        
            test('Multiple parentheses in URL', () => {
                expectSameTo('![alt text](image((multiple)).jpg)', '![alt text](image\\(\\(multiple\\)\\).jpg)');
            });
        
            test('Missing closing parenthesis in URL', () => {
                expectSame('![alt text](image.jpg');
            });
        
            test('Leading and trailing spaces in alt text', () => {
                expectSame('![   alt text   ](image.jpg)');
            });
        
            test('Leading and trailing spaces in URL', () => {
                expectSameTo('![alt text](   image.jpg   )', '![alt text](image.jpg)');
            });
        
            test('Leading and trailing spaces in title', () => {
                expectSame('![alt text](image.jpg "   Image Title   ")');
            });
        
            test('Empty title and URL', () => {
                expectSame('![alt text](" ")');
            });
        
            test('Incomplete syntax (missing closing square bracket)', () => {
                expectSame('![alt text(image.jpg)');
            });
        
            test('Incomplete syntax (missing closing parenthesis)', () => {
                expectSame('![alt text](image.jpg');
            });
        
            test('Newline inside alt text', () => {
                expectSame('![alt\ntext](image.jpg)');
            });
        
            test('Newline inside title', () => {
                expectSame('![alt text](image.jpg "Title\nWithNewline")');
            });
        
            test('Multiple consecutive spaces in URL', () => {
                expectSame('![alt text](image%20%20with%20spaces.jpg)');
            });
        
            test('Escaped spaces in URL', () => {
                expectSame('![alt text](image\\ with\\ spaces.jpg)');
            });
        });
    
        suite('HorizontalRule', () => {
            test('Basic ---', () => {
                expectSame('---');
            });
        
            test('Basic ***', () => {
                expectSame('***');
            });
        
            test('Basic ___', () => {
                expectSame('___');
            });
        
            test('With spaces before and after ---', () => {
                expectSame('  ---  ');
            });
        
            test('With spaces before and after ***', () => {
                expectSame('   ***   ');
            });
        
            test('With spaces before and after ___', () => {
                expectSame(' ___ ');
            });
        
            test('Invalid horizontal rule (too few dashes)', () => {
                expectSame('--'); // Should not be serialized as HR
            });
        
            test('Invalid horizontal rule (mixed symbols)', () => {
                expectSame('-*-'); // Should not be serialized as HR
            });
        
            test('More than 3 dashes ---', () => {
                expectSame('------'); // Should be serialized as HR
            });
        
            test('More than 3 asterisks ***', () => {
                expectSame('******'); // Should be serialized as HR
            });
        
            test('More than 3 underscores ___', () => {
                expectSame('______'); // Should be serialized as HR
            });
        
            test('Horizontal rule with spaces between dashes', () => {
                expectSame('- - -');
            });
        
            test('Horizontal rule with spaces between asterisks', () => {
                expectSame('* * *');
            });
        
            test('Horizontal rule with spaces between underscores', () => {
                expectSame('_ _ _');
            });
        
            test('Horizontal rule with newline before ---', () => {
                expectSame('\n---');
            });
        
            test('Horizontal rule with newline after ---', () => {
                expectSame('---\n');
            });
        
            test('Horizontal rule surrounded by paragraphs', () => {
                expectSame('Paragraph before\n\n---\n\nParagraph after');
            });
        
            test('Horizontal rule with mixed case asterisks', () => {
                expectSame('*** ** **');
            });
        
            test('Horizontal rule with mixed case dashes', () => {
                expectSame('--- -- --');
            });
        
            test('Horizontal rule with newline and spaces after ---', () => {
                expectSame('---   \n\n');
            });
        
            test('Horizontal rule with multiple newlines before ---', () => {
                expectSame('\n\n\n---');
            });
        
            test('Invalid horizontal rule with letters', () => {
                expectSame('---a---'); // Should not be serialized as HR
            });
        
            test('Invalid horizontal rule with special characters', () => {
                expectSame('---$---'); // Should not be serialized as HR
            });
        
            test('Multiple horizontal rules', () => {
                expectSame('---\n\n***\n\n___'); // Should serialize as multiple HRs
            });
        });
    
        suite('escape', () => {
            test('Asterisk', () => {
                expectSame('\\*This is not bold\\*');
            });
            
            test('Underscore', () => {
                expectSame('\\_This is not italic\\_');
            });
            
            test('Hash in heading', () => {
                expectSame('\\# This is not a heading');
            });
            
            test('Square brackets for links', () => {
                expectSame('\\[This is not a link\\]');
            });
            
            test('Parentheses in link text', () => {
                expectSame('[Link text](https://example.com/\\(escaped\\))');
            });
            
            test('Backslash', () => {
                expectSame('This is a backslash: \\\\');
            });
            
            test('Mixed special characters', () => {
                expectSame('\\*Not bold\\*, \\_not italic\\_, \\# not a heading, \\[not a link\\], and \\\\ backslash.');
            });
            
            test('Special characters in heading', () => {
                expectSame('# Heading with \\*escaped asterisk\\* and \\_escaped underscore\\_');
            });
            
            test('Special characters in blockquote', () => {
                expectSame('> Blockquote with \\# escaped hash and \\[escaped brackets\\]');
            });
        });
    
        suite('Space', () => {
            test('Basic space between paragraphs', () => {
                expectSame('paragraph 1.\nparagraph2.');
                expectSame('paragraph 1.\n\nparagraph2.');
            });
    
            test('Newline at the start', () => {
                expectSame('\nThis paragraph has a newline at the start.');
            });
    
            test('Multiple newline at the start', () => {
                expectSame('\n\n\nparagraph1');
            });
            
            test('Multiple newline at the end', () => {
                expectSame('paragraph1\n\n\n');
            });
    
            test('One single new line', () => {
                expectSame('\n');
            });
            
            test('Two consecutive new lines', () => {
                expectSame('\n\n');
            });
    
            test('Multiple consecutive empty lines', () => {
                expectSame('\n\n\n');
            });
    
            test('Multiple paragraphs with varying space', () => {
                expectSame('paragraph1\nparagraph1.5\nparagraph2');
                expectSame('paragraph 1.\n\nparagraph2.');
                expectSame('paragraph1\nparagraph1.5\nparagraph2');
            });
        
            test('Excessive newlines between paragraphs', () => {
                expectSame('paragraph 1.\n\n\nparagraph2.');
                expectSame('paragraph 1.\n\n\n\nparagraph2.');
            });
        
            test('Irregular spaces and newlines between paragraphs', () => {
                expectSame('paragraph 1.\n\n       \n  \nparagraph2.');
                expectSame('paragraph 1.\n12\n       \n  \nparagraph2.');
            });
        
            test('Space before paragraphs', () => {
                expectSame('   paragraph 1.\n\n   paragraph 2.');
            });
        
            test('Space after paragraphs', () => {
                expectSame('paragraph 1.   \n\nparagraph 2.   ');
            });
        
            test('Spaces and newlines with tabs', () => {
                expectSame('paragraph 1.\n\t\nparagraph 2.');
                expectSame('paragraph1\n 1 \t 2 \nparagraph2');
            });
        });
    
        suite('lineBreak', () => {
            test('Basic line break', () => {
                expectSame('First line\nSecond line');
            });
        
            test('Line break with trailing spaces', () => {
                expectSame('First line    \nSecond line');
            });
        
            test('Line break at the beginning of text', () => {
                expectSame('  \nNew line after break');
            });
        
            test('Multiple consecutive line breaks', () => {
                expectSame('Line 1  \n  \nLine 3');
            });
        
            test('Line break inside a blockquote', () => {
                expectSame('> First line  \n> Second line');
            });
        
            test('Line break with bold text', () => {
                expectSame('**Bold line**  \nNew line');
            });
        
            test('Line break with leading and trailing spaces', () => {
                expectSame('  Line with leading and trailing spaces  \nNext line.');
            });
        
            test('Line break with inline code', () => {
                expectSame('This is `inline code`  \nand a new line.');
            });
        
            test('Multiple consecutive line breaks with text', () => {
                expectSame('First line  \n  \n  \nFourth line');
            });
        
            test('Line break with italic text', () => {
                expectSame('*Italic text*  \nNew line');
            });
        
            test('Line break inside a heading', () => {
                expectSameTo('# Heading with break  \nNew line under heading', '# Heading with break\nNew line under heading');
            });
        
            test('Line break between links', () => {
                expectSame('[Link 1](https://example.com)  \n[Link 2](https://example.com)');
            });
        
            test('Line break before blockquote', () => {
                expectSame('Line before blockquote  \n> Blockquote starts here');
            });
        
            test('Line break with escaped characters', () => {
                expectSame('This is a backslash \\  \nand new line after');
            });
        
            test('Line break with mixed formatting', () => {
                expectSame('This is **bold**, *italic*, and a `code` span  \nNew line');
            });
        
            test('Multiple line breaks between paragraphs', () => {
                expectSame('Paragraph 1  \n  \nParagraph 2  \n  \nParagraph 3');
            });
        });
    
        suite('blockquote', () => {
            test('Basic blockquote with single line', () => {
                expectSame('> This is a blockquote.');
            });
        
            test('Blockquote with multiple lines', () => {
                expectSame('> This is a blockquote.\n> With multiple lines.');
            });
        
            test('Blockquote with leading spaces', () => {
                expectSame('   > This is a blockquote with leading spaces.');
            });
            
            test('Blockquote with multiple blockquote levels and leading spaces 1', () => {
                expectSame('   > Blockquote level 1.\n   >> Blockquote level 2.\n   >>> Blockquote level 3.');
            });
            
            test('Blockquote Complex Case 1', () => {
                expectSame('  >bq1: first line\n> bq1: second line\n>\n  >> bq2: first line\n > > bq2: second line');
            });
            
            test('Blockquote Complex Case 2', () => {
                expectSame('  >bq1: first line\n> bq1: second line\n>\n  >> bq2: first line\n > > bq2: second line\n>>   > bq3: first line');
            });
        
            test('Blockquote with trailing spaces', () => {
                expectSame('> This is a blockquote with trailing spaces.   ');
            });
        
            test('Nested blockQuotes', () => {
                expectSame('> This is a blockquote.\n>> Nested blockquote.');
            });
        
            test('Blockquote with empty lines between', () => {
                expectSame('> This is a blockquote.\n>\n> Another blockquote after an empty line.');
            });
        
            test('Blockquote with mixed content (emphasis)', () => {
                expectSame('> This is a blockquote with *emphasized* text.');
            });
        
            test('Blockquote with mixed content (strong)', () => {
                expectSame('> This is a blockquote with **bold** text.');
            });
        
            test('Blockquote with mixed content (code)', () => {
                expectSame('> This is a blockquote with `inline code`.');
            });
        
            test('Blockquote with a heading', () => {
                expectSame('> # This is a heading inside a blockquote.');
            });
        
            test('Blockquote followed by regular text', () => {
                expectSame('> This is a blockquote.\n\nRegular text after blockquote.');
            });
        
            test('Blockquote with multiple paragraphs', () => {
                expectSame('> This is the first paragraph inside a blockquote.\n>\n> This is the second paragraph.');
            });
        
            test('Blockquote with multiple blockquote levels and content', () => {
                expectSame('> Blockquote level 1\n>> Blockquote level 2\n>>> Blockquote level 3');
            });
        
            test('Blockquote with special characters', () => {
                expectSame('> This is a blockquote with special characters: !@#$%^&*()');
            });
        
            test('Blockquote with link inside', () => {
                expectSame('> This is a blockquote with a [link](https://example.com).');
            });
        
            test('Blockquote followed by heading', () => {
                expectSame('> This is a blockquote.\n\n# Heading after blockquote.');
            });
        
            test('Blockquote with an image inside', () => {
                expectSame('> This is a blockquote with an image ![Alt text](image.jpg).');
            });
        
            test('Invalid blockquote (missing blockquote marker)', () => {
                expectSame('This is not a blockquote, just a regular paragraph.');
            });
        
            test('Blockquote followed by a horizontal rule', () => {
                expectSame('> This is a blockquote.\n\n---');
            });
        
            test('Blockquote with trailing line breaks', () => {
                expectSame('> This is a blockquote with trailing line breaks.\n\n');
            });
        
            test('Blockquote with emphasis followed by regular text', () => {
                expectSame('> This is a blockquote with *emphasis*.\n\nRegular text.');
            });
        
            test('Blockquote with strong emphasis followed by regular text', () => {
                expectSame('> This is a blockquote with **bold** text.\n\nRegular text.');
            });

            test('Blockquote with space token inside', () => {
                expectSame('> p1\n>\n>\np2');
            });
            
            test('Blockquote with <br>', () => {
                expectSame('> p1\n<br>');
            });
            
            test('Blockquote with <br> 2', () => {
                expectSame('> p1\n   <br>');
            });
        });

        suite('codeblock', () => {
            test('Basic fenced code block with backticks', () => {
                expectSame('```\nconsole.log("Hello, World!");\n```');
            });
        
            test('Basic fenced code block with tildes', () => {
                expectSame('~~~\nconsole.log("Hello, World!");\n~~~');
            });
        
            test('Fenced code block with language (JavaScript)', () => {
                expectSame('```javascript\nconsole.log("Hello, World!");\n```');
            });
        
            test('Fenced code block with special characters', () => {
                expectSame('```\n<>&{}\n```');
            });
            
            test('Code block with empty text 1', () => {
                expectSame('``````');
            });

            test('Code block with empty text 2', () => {
                expectSame('```\n```');
            });
            
            test('Code block with empty text 3', () => {
                expectSame('```\n`````');
            });
        
            test('Fenced code block with more than three backticks', () => {
                expectSame('````\nCode with four backticks\n````');
            });
        
            test('Code block with multiple lines', () => {
                expectSame('```\nLine 1\nLine 2\nLine 3\n```');
            });
        
            test('Code block with inline comments', () => {
                expectSame('```\n// This is a comment\nconsole.log("Code with comment");\n```');
            });
        
            test('Code block with HTML content', () => {
                expectSame('```\n<div>Hello World</div>\n```');
            });
        
            test('Indented code block with spaces', () => {
                expectSame('    console.log("Indented code block");');
            });
        
            test('Fenced code block with spaces inside backticks', () => {
                expectSameTo('``` \nCode with space after backticks\n```', '```\nCode with space after backticks\n```');
            });
        
            test('Code block with mixed tabs and spaces', () => {
                expectSame('```\n\tconsole.log("Mixed tabs and spaces");\n```');
            });
        
            test('Code block followed by regular text', () => {
                expectSame('```\nconsole.log("Code block");\n```\n\nRegular text after code block.');
            });
        
            test('Code block with empty lines inside', () => {
                expectSame('```\nconsole.log("First line");\n\nconsole.log("Second line");\n```');
            });
        
            test('Code block with extra blank lines before and after', () => {
                expectSame('\n\n```\nconsole.log("Hello");\n```\n\n');
            });
        
            test('Fenced code block with invalid closing fence', () => {
                expectSame('```\nconsole.log("Unclosed code block");\n``'); // Missing last backtick
            });
        
            test('Code block containing blockQuotes', () => {
                expectSame('```\n> Blockquote inside code\nconsole.log("Still code");\n```');
            });
        
            test('Code block with special characters and spaces', () => {
                expectSame('```\n!@#$%^&*()   _+{}|:"<>?\n```');
            });
        
            test('Nested code block within a blockquote', () => {
                expectSame('> ```\n> console.log("Nested code block");\n> ```');
            });
        
            // FIX: see https://github.com/markedjs/marked/issues/3514
            test.skip('Code block with mismatched closing fence style 1', () => {
                expectSame('```\nMismatched closing style\n~~~');
            });
            
            // FIX: see https://github.com/markedjs/marked/issues/3514
            test.skip('Code block with mismatched closing fence style 2', () => {
                expectSame('```\nMismatched closing style\n~~~~');
            });
        
            test('Code block with heading and fenced code', () => {
                expectSame('# Heading\n```\nCode under heading\n```');
            });

            test('Code block with line breaks between code', () => {
                expectSame('```\nconsole.log("Line 1");\n\nconsole.log("Line 3");\n```');
            });
        
            test('Code block with special Markdown syntax characters inside', () => {
                expectSame('```\n# This is not a heading\n- This is not a list item\n```');
            });
        
            test('Code block with Python syntax', () => {
                expectSame('```python\nprint("Hello, Python!")\n```');
            });
        
            test('Multiple consecutive code blocks', () => {
                expectSame('```\nFirst code block\n```\n\n```\nSecond code block\n```');
            });

            test('codeBlock - with new line at the end 1', () => {
                expectSame('```ts\nconsole.log("hello world");\n```\n');
            });
            
            test('codeBlock - with new line at the end 2', () => {
                expectSame('```ts\nconsole.log("hello world");\n```\n\n\n\n\n');
            });
            
            test('codeBlock - with new line at the end 3', () => {
                expectSame('```ts\nconsole.log("hello world");```\n');
            });
        });

        suite('list', () => {
            test('Unordered list - Basic', () => {
                expectSame('- Item 1\n- Item 2\n- Item 3');
            });
        
            test('Ordered list - Basic', () => {
                expectSame('1. First item\n2. Second item\n3. Third item');
            });
        
            test('Ordered list - Non-standard start', () => {
                expectSame('5. First item\n6. Second item\n7. Third item');
            });
        
            test('Unordered list - Mixed symbols', () => {
                expectSame('- Item 1\n* Item 2\n+ Item 3');
            });
        
            test('Nested unordered list', () => {
                expectSame('- Item 1\n  - Nested Item 1.1\n  - Nested Item 1.2\n- Item 2');
            });
        
            test('Nested ordered list', () => {
                expectSame('1. First item\n   1. Nested item 1.1\n   2. Nested item 1.2\n2. Second item');
            });
        
            test('Mixed ordered and unordered lists', () => {
                expectSame('1. Ordered item\n   - Unordered nested item\n2. Ordered item');
            });
        
            test.skip('Unordered list - Indented items', () => {
                expectSame('  - Indented item 1\n    - More indented item 1.1\n  - Indented item 2');
            });
        
            test.skip('Ordered list - Indented items', () => {
                expectSame('   1. Indented item 1\n      2. More indented item 1.1\n   2. Indented item 2');
            });
        
            test.skip('Unordered list - Line breaks between items', () => {
                expectSame('- Item 1\n\n- Item 2\n\n- Item 3');
            });
        
            test.skip('Ordered list - Line breaks between items', () => {
                expectSame('1. Item 1\n\n2. Item 2\n\n3. Item 3');
            });
        
            test('List with special characters', () => {
                expectSame('- Item with special characters !@#$%^&*()\n- Another item *bold* _italic_');
            });
        
            test('List with bold and italic formatting', () => {
                expectSame('- **Bold item**\n- *Italic item*\n1. **Bold ordered item**\n2. *Italic ordered item*');
            });
        
            test.skip('Ordered list - Incorrect numbering', () => {
                expectSame('1. Item 1\n3. Item 2\n2. Item 3'); // Should not renumber automatically
            });
        
            test.skip('List with mixed indentation', () => {
                expectSame('- Item 1\n     - Deeply indented item\n- Item 2\n    - Less indented item');
            });
        
            test.skip('List with trailing and leading spaces', () => {
                expectSame('  - Leading and trailing spaces   \n- Regular item  ');
            });
        
            test.skip('Complex nested lists', () => {
                expectSame('1. Item 1\n   - Nested Item\n      * Deep Nested Item\n2. Item 2\n   1. Nested Ordered Item\n      - Mixed Nested Item');
            });
        });
    });
    
    suite('inline-level', () => {
        suite('em', () => {
            test('Basic emphasis with *', () => {
                expectSame('*This is emphasized*');
            });
        
            test('Basic emphasis with _', () => {
                expectSame('_This is emphasized_');
            });
        
            test('Emphasis in the middle of text', () => {
                expectSame('This is *emphasized* in the middle.');
            });
        
            test('Emphasis with special characters inside', () => {
                expectSame('*This is !@# emphasized*');
            });
        
            test('Emphasis with multiple spaces inside', () => {
                expectSame('*This   is   emphasized*');
            });
        
            test('Emphasis combined with bold', () => {
                expectSame('**This is bold and *emphasized* text**');
            });
        
            test('Emphasis with code inside', () => {
                expectSame('*Emphasized `code` inside*');
            });
        
            test('Emphasis with link inside', () => {
                expectSame('*This is [a link](https://example.com) inside*');
            });
        
            test('Emphasis at the beginning and end', () => {
                expectSame('*Emphasized* at the beginning and end *again*');
            });
        
            test('Multiple adjacent emphasized sections', () => {
                expectSame('*First* *Second* *Third*');
            });
        
            test('Nested emphasis', () => {
                expectSameTo('*This is *nested emphasis**', '*This is nested emphasis*'); // overlap, remove the nested unused one.
            });
        
            test('Emphasis across multiple lines (invalid)', () => {
                expectSame('This is *emphasized\nacross two lines*'); // Should not be serialized as valid emphasis
            });
        
            test('Invalid emphasis (single asterisk)', () => {
                expectSame('This is * invalid emphasis');
            });
        
            test('Invalid emphasis (unmatched asterisks)', () => {
                expectSame('*This is invalid emphasis');
            });
        
            test('Emphasis with nested emphasis', () => {
                expectSameTo('*This is *italic* text*', '*This is italic text*');
            });
    
            test('Emphasis with mixed formatting and escape characters', () => {
                expectSameTo('*This is **bold**, *italic*, and \\*escaped\\* text*', '*This is **bold**, italic, and \\*escaped\\* text*');
            });
        
            test('Emphasis with inline HTML tag', () => {
                expectSame('*Emphasis with <strong>HTML</strong> tag*');
            });
        
            test('Emphasis with self-closing HTML tag', () => {
                expectSame('*Emphasis with <img src="image.jpg" alt="img"/> inside*');
            });
        
            test('Emphasis with digits inside', () => {
                expectSame('*1234*');
            });
        
            test('Emphasis with underscores and digits inside', () => {
                expectSame('_1234_');
            });
        
            test('Emphasis with escape sequence', () => {
                expectSame('\\*This is not emphasized\\*');
            });
        
            test('Emphasis with empty content', () => {
                expectSame('**'); // Empty emphasis
            });
            
            test('Emphasis incomplete', () => {
                expectSame('_');
            });
        
            test('Emphasis surrounded by underscores and spaces', () => {
                expectSame('_ This should be emphasized _');
            });
        
            test('Emphasis with invalid characters around', () => {
                expectSame('*This is emphasized*text');
            });
        
            test('Emphasis with repeated underscores and spaces', () => {
                expectSame('_ This _ is _emphasized_ text _');
            });
        
            test('Emphasis with multiple underscores inside', () => {
                expectSame('_This_is_emphasized_text_');
            });
        
            test('Emphasis followed by punctuation', () => {
                expectSame('*This is emphasized*!');
            });
        
            test('Emphasis inside a heading', () => {
                expectSame('# Heading with *emphasized* text');
            });
        
            test('Emphasis with nested strong and links', () => {
                expectSame('*This is **bold** and [link](https://example.com) inside*');
            });
        
            test('Emphasis around parentheses and special characters', () => {
                expectSame('*This is (emphasized) text!*');
            });
        
            test('Emphasis with special characters at the start and end', () => {
                expectSame('This is *!emphasized!*');
            });
        });
    
        suite('strong', () => {
            test('Basic bold with **', () => {
                expectSame('**This is bold**');
            });
        
            test('Basic bold with __', () => {
                expectSame('__This is bold__');
            });
        
            test('Bold in the middle of text', () => {
                expectSame('This is **bold** in the middle.');
            });
        
            test('Bold with special characters inside', () => {
                expectSame('**This is !@#$%^&*() bold**');
            });
        
            test('Bold with multiple spaces inside', () => {
                expectSame('**This   is   bold**');
            });
        
            test('Bold with leading and trailing spaces', () => {
                expectSame('**   Bold with spaces   **');
            });
        
            test('Bold combined with emphasis', () => {
                expectSame('**This is bold and *emphasized* text**');
            });
        
            test('Bold with code inside', () => {
                expectSame('**Bold `code` inside**');
            });
        
            test('Bold with link inside', () => {
                expectSame('**This is [a link](https://example.com) inside**');
            });
        
            test('Bold at the beginning and end', () => {
                expectSame('**Bold** at the beginning and end **again**');
            });
        
            test('Multiple adjacent bold sections', () => {
                expectSame('**First** **Second** **Third**');
            });
        
            test('Nested bold and emphasis', () => {
                expectSame('**This is **nested *emphasis* bold**');
            });
        
            test('Invalid bold (single asterisk)', () => {
                expectSame('This is * invalid bold');
            });
        
            test('Invalid bold (unmatched asterisks)', () => {
                expectSame('**This is invalid bold');
            });
        
            test('Bold with mixed formatting and escape characters', () => {
                expectSameTo('**This is *italic*, **bold**, and \\*escaped\\* text**', '**This is *italic*, bold, and \\*escaped\\* text**');
            });
        
            test('Bold with inline HTML tag', () => {
                expectSame('**Bold with <em>HTML</em> tag**');
            });
        
            test('Bold with self-closing HTML tag', () => {
                expectSame('**Bold with <img src="image.jpg" alt="img"/> inside**');
            });
        
            test('Bold with digits inside', () => {
                expectSame('**1234**');
            });
        
            test('Bold with underscores and digits inside', () => {
                expectSame('__1234__');
            });
        
            test('Bold with escape sequence', () => {
                expectSame('\\**This is not bold\\**');
            });
        
            test('Bold with empty content', () => {
                expectSame('****'); // Empty bold
            });
        
            test('Bold surrounded by underscores and spaces', () => {
                expectSame('__ This should be bold __');
            });
        
            test('Bold with invalid characters around', () => {
                expectSame('**This is bold**text');
            });
        
            test('Bold with repeated underscores and spaces', () => {
                expectSame('__ This __ is __bold__ text __');
            });
        
            test('Bold with multiple underscores inside', () => {
                expectSame('__This_is_bold_text__');
            });
        
            test('Bold followed by punctuation', () => {
                expectSame('**This is bold**!');
            });
        
            test('Bold inside a heading', () => {
                expectSame('# Heading with **bold** text');
            });
    
            test('Bold with nested emphasis and links', () => {
                expectSame('**This is *italic* and [link](https://example.com) inside**');
            });
        
            test('Bold around parentheses and special characters', () => {
                expectSame('**This is (bold) text!**');
            });
        
            test('Bold with special characters at the start and end', () => {
                expectSame('This is **!bold!**');
            });
        });
    
        suite('codespan', () => {
            test('Basic inline code with single backticks', () => {
                expectSame('`code`');
            });
            
            test('Inline code with special characters', () => {
                expectSame('`!@#$%^&*()_+~=-[]{}\\|;:\'"<,>.?/`');
            });
            
            test('Inline code with leading and trailing spaces', () => {
                expectSame('`   code   `');
            });
            
            test('Inline code with multiple backticks', () => {
                expectSame('``code with `backticks` inside``');
            });
            
            test('Inline code with triple backticks', () => {
                expectSame('```code with ``double backticks`` inside```');
            });
        
            test('Inline code at the start of a line', () => {
                expectSame('`code` at the start of a line');
            });
        
            test('Inline code at the end of a line', () => {
                expectSame('This is some text with `code`');
            });
        
            test('Multiple inline codes in a single line', () => {
                expectSame('This is `code1` and this is `code2`.');
            });
        
            test('Inline code with mixed formatting', () => {
                expectSame('This is *italic* and `code` with **bold**');
            });
            
            test('Inline code with a link inside', () => {
                expectSame('`[Link](https://example.com)`');
            });
            
            test('Inline code with escape sequences', () => {
                expectSame('`\\*This is not italic\\*`');
            });
        
            test('Inline code with asterisks inside', () => {
                expectSame('`*this is not italic*`');
            });
        
            test('Inline code with mixed spaces and tabs', () => {
                expectSame('`code with \t tabs and   spaces`');
            });
        
            test('Inline code with emphasis around', () => {
                expectSame('*This is emphasized with `inline code` inside*');
            });
        
            test('Inline code with HTML inside', () => {
                expectSame('`<strong>HTML</strong>` inside code');
            });
        
            test('Inline code with numbers', () => {
                expectSame('`1234567890`');
            });
        
            test('Inline code next to punctuation', () => {
                expectSame('This is inline code `code`, followed by punctuation.');
            });
        
            test('Inline code inside a heading', () => {
                expectSame('# Heading with `inline code`');
            });
        
            test('Inline code with leading backticks', () => {
                expectSame('```code``` with leading backticks');
            });
        
            test('Inline code surrounded by parentheses', () => {
                expectSame('This is (inline `code`)');
            });
        
            test('Inline code with empty content', () => {
                expectSame('``');
            });
        
            test('Inline code with underscores', () => {
                expectSame('`code_with_underscores`');
            });
        
            test('Inline code with dashes', () => {
                expectSame('`code-with-dashes`');
            });
        
            test('Invalid inline code with mismatched backticks', () => {
                expectSame('``code with mismatched backticks`');
            });
        
            test('Inline code across multiple lines (invalid)', () => {
                expectSame('This is `inline\ncode across lines`');
            });
        });
        
        suite('link', () => {
            test('Basic link', () => {
                expectSame('[example](https://example.com)');
            });
        
            test('Link with title', () => {
                expectSame('[example](https://example.com "Example Title")');
            });
        
            test('Link with special characters in URL', () => {
                expectSame('[example](https://example.com/path?query=1&test=2)');
            });
        
            test('Link with escaped parentheses in URL 1', () => {
                expectSameTo('[example](https://example.com/path(withparentheses))', '[example](https://example.com/path\\(withparentheses\\))');
            });
            
            test('Link with escaped parentheses in URL 2', () => {
                expectSame('[example](https://example.com/path\\(withparentheses\\))');
            });
        
            test('Link with space in URL', () => {
                expectSame('[example](https://example.com/path%20with%20spaces)');
            });
        
            test('Link with encoded characters in URL', () => {
                expectSame('[example](https://example.com/%E2%9C%93)');
            });
        
            test('Inline link next to text', () => {
                expectSame('Here is a [link](https://example.com) in the middle of text.');
            });
        
            test('Multiple consecutive links', () => {
                expectSame('[first](https://first.com) [second](https://second.com)');
            });
        
            test('Link with emphasis inside', () => {
                expectSame('[*emphasized link*](https://example.com)');
            });
        
            test('Link with bold inside', () => {
                expectSame('[**bold link**](https://example.com)');
            });
        
            test('Link with inline code inside', () => {
                expectSame('[`code link`](https://example.com)');
            });
        
            test('Link with title and emphasis inside', () => {
                expectSame('[*emphasized link*](https://example.com "Example Title")');
            });
        
            test('Link with self-closing HTML tag inside', () => {
                expectSame('[Link with image](https://example.com) <img src="image.jpg" alt="image"/>');
            });
        
            test('Link with special characters in label', () => {
                expectSame('[example !@#$%^&*()](https://example.com)');
            });
        
            test('Link with nested parentheses in label', () => {
                expectSame('[example (with nested parentheses)](https://example.com)');
            });
        
            test('Link with escape sequences in label', () => {
                expectSame('[example \\(escaped\\)](https://example.com)');
            });
        
            test('Link with escape sequences in URL', () => {
                expectSame('[example](https://example.com/path\\(escaped\\))');
            });
        
            // FIX: should work after 'marked' update
            test.skip('Link with escaped characters in title', () => {
                expectSame('[example](https://example.com "Title with \\"quotes\\"")');
            });
        
            test('Invalid link with line break inside label', () => {
                expectSame('[example\nwith break](https://example.com)'); // Should not be treated as a valid link
            });
        
            test('Invalid link (no closing bracket)', () => {
                expectSame('[example(https://example.com)'); // Invalid, missing closing bracket
            });
        
            test('Invalid link (malformed URL)', () => {
                expectSame('[example](example.com)'); // Missing protocol
            });
        
            test('Invalid link (missing URL)', () => {
                expectSame('[example]()'); // Invalid, empty URL
            });
        
            test('Link surrounded by emphasis and bold', () => {
                expectSame('*Here is a [link](https://example.com) in* **the** *middle of* text.');
            });
        
            test('Link inside a heading', () => {
                expectSame('# This is a heading with a [link](https://example.com)');
            });
        
            test('Link with trailing punctuation', () => {
                expectSame('Here is a [link](https://example.com).');
            });
        
            test('Link with underscores and special characters in URL', () => {
                expectSame('[example](https://example.com/path_with_underscores_and_special_chars)');
            });
        
            test('Escaped characters around the link', () => {
                expectSame('\\[example](https://example.com)');
            });
        
            test('Link followed by inline code', () => {
                expectSame('Here is a [link](https://example.com) and `inline code`');
            });
        
            test('Link surrounded by parentheses', () => {
                expectSame('(Here is a [link](https://example.com))');
            });
        });
    });
});