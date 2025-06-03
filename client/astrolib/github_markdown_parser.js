// Simple markdown parser for GitHub changelog formatting
export function parseMarkdown(text) {
    if (!text) return '';

    // Normalize line endings - convert \r\n to \n and remove any stray \r characters
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Helper function to escape HTML
    const escapeHtml = (unsafe) => {
        return unsafe
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };

    // Helper function to process inline formatting
    const processInlineFormatting = (content) => {
        // First escape any raw HTML in the content
        let processed = escapeHtml(content);

        // Then apply markdown formatting
        return processed
            // Bold
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/__(.+?)__/g, '<strong>$1</strong>')
            // Italic
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/_(.+?)_/g, '<em>$1</em>')
            // Strikethrough
            .replace(/~~(.+?)~~/g, '<del>$1</del>')
            // Inline code
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            // Links - we need to unescape the URL part
            .replace(/\[(.+?)\]\((.+?)\)/g, (match, text, url) => {
                const unescapedUrl = url
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&quot;/g, '"')
                    .replace(/&#039;/g, '\'');
                return `<a href="${unescapedUrl}" target="_blank" rel="noopener noreferrer">${text}</a>`;
            });
    };

    // Split into lines for processing
    const lines = text.split('\n');
    let output = [];
    let inCodeBlock = false;
    let inBlockquote = false;
    let blockquoteContent = [];
    let lastWasHeader = false;
    let currentList = null; // Track current list state: { type: 'ul'|'ol', indent: number }

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        const trimmedLine = line.trim();

        // Handle code blocks
        if (trimmedLine.startsWith('```')) {
            if (!inCodeBlock) {
                inCodeBlock = true;
                // Get language if specified
                const language = trimmedLine.slice(3).trim();
                output.push(`<pre><code class="language-${language}">`);
            } else {
                inCodeBlock = false;
                output.push('</code></pre>');
            }
            lastWasHeader = false;
            continue;
        }

        if (inCodeBlock) {
            output.push(escapeHtml(line));
            continue;
        }

        // Handle blockquotes
        if (trimmedLine.startsWith('>')) {
            if (!inBlockquote) {
                inBlockquote = true;
                blockquoteContent = [];
            }
            blockquoteContent.push(trimmedLine.slice(1).trim());
            lastWasHeader = false;
            continue;
        } else if (inBlockquote) {
            inBlockquote = false;
            output.push(`<blockquote>${processInlineFormatting(blockquoteContent.join('\n'))}</blockquote>`);
        }

        // Handle headers
        const headerMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
        if (headerMatch) {
            const level = headerMatch[1].length;
            const content = headerMatch[2];
            // Add margin-top only if the previous element wasn't a header and this isn't the first element
            const marginTop = (lastWasHeader || output.length === 0) ? '0' : '0.75em';
            output.push(`<h${level} style="margin-top: ${marginTop}; margin-bottom: 0.15em;">${processInlineFormatting(content)}</h${level}>`);
            lastWasHeader = true;
            continue;
        }
        lastWasHeader = false;

        // Handle horizontal rules
        if (/^[-*_]{3,}$/.test(trimmedLine)) {
            output.push('<hr>');
            continue;
        }

        // Handle lists (both bulleted and numbered)
        const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/);
        if (listMatch) {
            const [, indent, marker, content] = listMatch;
            const indentLevel = indent.length;
            const isOrdered = /^\d+\.$/.test(marker);
            const listType = isOrdered ? 'ol' : 'ul';

            // Close current list if changing type or indent level
            if (currentList && (currentList.type !== listType || currentList.indent !== indentLevel)) {
                output.push(`</${currentList.type}>`);
                currentList = null;
            }

            // Start new list if needed
            if (!currentList) {
                currentList = { type: listType, indent: indentLevel };
                output.push(`<${listType}>`);
            }

            const processedContent = processInlineFormatting(content);
            output.push(`<li>${processedContent}</li>`);
            continue;
        }
        
        // If we have an open list and encounter non-list content, close it
        if (currentList) {
            output.push(`</${currentList.type}>`);
            currentList = null;
        }

        // Handle task lists
        if (trimmedLine.match(/^[-*+]\s+\[([ x])\]\s+(.+)$/i)) {
            const [, checked, content] = trimmedLine.match(/^[-*+]\s+\[([ x])\]\s+(.+)$/i);
            const processedContent = processInlineFormatting(content);
            output.push(`<div class="task-list-item"><input type="checkbox" ${checked === 'x' ? 'checked' : ''} disabled> ${processedContent}</div>`);
            continue;
        }

        // Handle paragraphs and empty lines
        if (trimmedLine) {
            output.push(`<p style="margin: 0.25em 0;">${processInlineFormatting(trimmedLine)}</p>`);
        } else {
            output.push('<br>');
        }
    }

    // Close any open blocks
    if (currentList) {
        output.push(`</${currentList.type}>`);
    }
    if (inBlockquote) {
        output.push(`<blockquote>${processInlineFormatting(blockquoteContent.join('\n'))}</blockquote>`);
    }
    if (inCodeBlock) {
        output.push('</code></pre>');
    }

    // Clean up empty paragraphs
    let result = output.join('\n')
        .replace(/<p><\/p>/g, '')
        .replace(/<br>\n{2,}/g, '<br>\n')
        .replace(/\n{2,}<br>/g, '\n<br>')
        .replace(/\n{3,}/g, '\n\n');

    return result;
} 