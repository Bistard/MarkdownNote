/**
 * Those token types are identical to {@link marked.Tokens.type}.
 */
export const enum TokenEnum {
    Space = 'space',
    CodeBlock = 'code',
    Heading = 'heading',
    Table = 'table', // TODO
    HorizontalRule = 'hr',
    Blockquote = 'blockquote',
    List = 'list',
    ListItem = 'list_item',
    Paragraph = 'paragraph',
    HTML = 'html',
    InlineHTML = 'inline_html',
    Text = 'text',
    Def = 'def', // TODO
    Escape = 'escape',
    Image = 'image',
    LineBreak = 'br',
    MathBlock = 'mathBlock',
    MathInline = 'mathInline',
}

export const enum MarkEnum {
    Link = 'link',
    Strong = 'strong',
    Em = 'em',
    Codespan = 'codespan',
    // marked.Tokens.Tag // TODO
    Del = 'del', // TODO
}