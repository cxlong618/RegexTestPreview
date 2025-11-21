import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('regex-test-preview.open', () => {
        const panel = vscode.window.createWebviewPanel(
            'regexTestPreview',
            'Regex Test Preview',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: []
            }
        );

        panel.webview.html = getSimpleHTML();

        // 发送最后使用的正则表达式
        const lastRegex = getLastUsedRegex(context);
        if (lastRegex) {
            panel.webview.postMessage({
                command: 'loadLastRegex',
                pattern: lastRegex.pattern,
                flags: lastRegex.flags
            });
        }

        panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'testRegex':
                        try {
                            const matches = testRegex(message.pattern, message.text, message.flags);

                            // 保存当前使用的正则表达式
                            saveLastUsedRegex(context, message.pattern, message.flags);

                            panel.webview.postMessage({ command: 'showMatches', matches: matches });
                        } catch (error) {
                            panel.webview.postMessage({
                                command: 'showError',
                                error: error instanceof Error ? error.message : 'Unknown error'
                            });
                        }
                        break;

                    case 'saveRegex':
                        saveLastUsedRegex(context, message.pattern, message.flags);
                        break;
                }
            },
            undefined,
            context.subscriptions
        );
    });

    context.subscriptions.push(disposable);
}

function getLastUsedRegex(context: vscode.ExtensionContext): { pattern: string; flags: string } | null {
    return context.workspaceState.get<{ pattern: string; flags: string } | undefined>('lastRegex') || null;
}

function saveLastUsedRegex(context: vscode.ExtensionContext, pattern: string, flags: string) {
    if (!pattern || pattern.trim() === '') {
        return;
    }

    // 保存最后使用的正则表达式（基于工作区）
    context.workspaceState.update('lastRegex', {
        pattern: pattern.trim(),
        flags: flags || 'g'
    });
}

function testRegex(pattern: string, text: string, flags: string): Array<{start: number, end: number, text: string}> {
    if (!pattern || pattern.trim() === '') {
        return [];
    }

    try {
        const regex = new RegExp(pattern, flags);
        const matches = [];
        let match;

        while ((match = regex.exec(text)) !== null) {
            matches.push({
                start: match.index,
                end: match.index + match[0].length,
                text: match[0]
            });

            if (match.index === regex.lastIndex) {
                regex.lastIndex++;
            }
        }

        return matches;
    } catch (error) {
        throw error;
    }
}

function getSimpleHTML(): string {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Regex Test Preview</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #1e1e1e;
            color: #d4d4d4;
            margin: 0;
            padding: 20px;
        }
        .container {
            max-width: 100%;
            height: calc(100vh - 40px);
            display: flex;
            flex-direction: column;
        }
        .input-group {
            margin-bottom: 15px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
            color: #fff;
        }
        .regex-input-row {
            display: flex;
            gap: 10px;
            align-items: center;
            margin-bottom: 15px;
        }
        .regex-input, .flags-input {
            padding: 8px 12px;
            border: 1px solid #3c3c3c;
            background-color: #252526;
            color: #d4d4d4;
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 14px;
            border-radius: 3px;
            box-sizing: border-box;
        }
        .regex-input {
            flex: 1;
            height: 32px;
        }
        .flags-input {
            width: 120px;
            height: 32px;
            flex-shrink: 0;
        }
        .flags-select {
            width: 120px;
            height: 32px;
            padding: 6px 8px;
            border: 1px solid #3c3c3c;
            background-color: #252526;
            color: #d4d4d4;
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 13px;
            border-radius: 3px;
            box-sizing: border-box;
            cursor: pointer;
            flex-shrink: 0;
        }
        .flags-select:focus {
            outline: none;
            border-color: #0078d4;
            box-shadow: 0 0 0 2px rgba(0,120,212,0.2);
        }
        .flags-select option {
            background-color: #252526;
            color: #d4d4d4;
            padding: 4px 8px;
        }
        .flags-info {
            font-size: 10px;
            color: #858585;
            margin-left: 8px;
            white-space: nowrap;
            flex-shrink: 0;
        }
        .regex-input:focus, .flags-input:focus {
            outline: none;
            border-color: #0078d4;
            box-shadow: 0 0 0 2px rgba(0,120,212,0.2);
        }
        .editor-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            border: 1px solid #3c3c3c;
            border-radius: 3px;
            overflow: hidden;
            min-height: 300px;
            position: relative;
        }
        #textEditor {
            width: 100%;
            flex: 1;
            resize: none;
            white-space: pre-wrap;
            word-wrap: break-word;
            line-height: 1.5;
            padding: 8px 12px;
            border: none;
            background: transparent;
            color: #d4d4d4;
            font-family: 'Consolas', 'Microsoft YaHei', 'SimHei', monospace;
            font-size: 14px;
            box-sizing: border-box;
            outline: none;
            overflow-y: auto;
        }
        #textEditor:focus {
            outline: none;
        }
        .highlight {
            background-color: yellow;
            color: black;
            font-weight: bold;
            border-radius: 2px;
            padding: 0 2px;
        }
        .error {
            color: #f48771;
            font-size: 12px;
            margin-top: 5px;
        }
        .status {
            margin-top: 10px;
            font-size: 12px;
            color: #cccccc;
        }

        /* 模式控件样式 */
        .mode-controls {
            margin-bottom: 10px;
            padding: 10px;
            background-color: #2a2a2a;
            border-radius: 4px;
            border: 1px solid #3c3c3c;
        }

        .mode-buttons {
            display: flex;
            gap: 5px;
            margin-bottom: 10px;
        }

        .mode-btn {
            padding: 6px 12px;
            border: 1px solid #555;
            background-color: #333;
            color: #ccc;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
            transition: all 0.2s ease;
        }

        .mode-btn:hover {
            background-color: #444;
            border-color: #666;
        }

        .mode-btn.active {
            background-color: #007acc;
            border-color: #007acc;
            color: white;
        }

        .controls-section {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .action-btn {
            padding: 8px 16px;
            border: none;
            background-color: #28a745;
            color: white;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            transition: background-color 0.2s ease;
        }

        .action-btn:hover {
            background-color: #218838;
        }

        .action-btn:active {
            background-color: #1e7e34;
        }

        .mode-desc {
            font-size: 11px;
            color: #999;
            font-style: italic;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Regex Test Preview</h1>

        <div class="input-group">
            <label for="pattern">Regular Expression:</label>
            <div class="regex-input-row">
                <input type="text" id="pattern" class="regex-input" placeholder="Enter regex pattern..." value="">
                <select id="flags" class="flags-select" title="Select regex flags">
                    <option value="">None</option>
                    <option value="g" selected>g - Global</option>
                    <option value="i">i - Ignore Case</option>
                    <option value="m">m - Multiline</option>
                    <option value="s">s - Single Line</option>
                    <option value="u">u - Unicode</option>
                    <option value="y">y - Sticky</option>
                    <option value="gi">gi - Global + Ignore Case</option>
                    <option value="gm">gm - Global + Multiline</option>
                    <option value="gs">gs - Global + Single Line</option>
                    <option value="im">im - Ignore Case + Multiline</option>
                    <option value="gim">gim - Global + Ignore Case + Multiline</option>
                    <option value="gims">gims - All flags</option>
                </select>
                <span class="flags-info">选择正则表达式标志</span>
            </div>
        </div>

        <div class="input-group">
            <label for="textEditor">Test Text:</label>

            <!-- 模式切换和操作按钮 -->
            <div class="mode-controls">
                <div class="mode-buttons">
                    <button id="pasteModeBtn" class="mode-btn active">粘贴模式</button>
                    <button id="inputModeBtn" class="mode-btn">输入模式</button>
                </div>

                <!-- 粘贴模式按钮 -->
                <div id="pasteControls" class="controls-section">
                    <button id="pasteClipboardBtn" class="action-btn">📋 清空并粘贴剪切板内容</button>
                    <span class="mode-desc">自动高亮显示匹配结果</span>
                </div>

                <!-- 输入模式按钮 -->
                <div id="inputControls" class="controls-section" style="display: none;">
                    <button id="highlightBtn" class="action-btn">✨ 高亮显示</button>
                    <span class="mode-desc">输入完成后点击按钮执行高亮</span>
                </div>
            </div>

            <div class="editor-container">
                <div id="textEditor" contenteditable="true" spellcheck="false" placeholder="Enter text to test against the regex..."></div>
            </div>
        </div>

        <div id="status" class="status">Ready to test regex</div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const patternInput = document.getElementById('pattern');
        const flagsInput = document.getElementById('flags');
        const textEditor = document.getElementById('textEditor');
        const statusDiv = document.getElementById('status');

        // 模式控件元素
        const pasteModeBtn = document.getElementById('pasteModeBtn');
        const inputModeBtn = document.getElementById('inputModeBtn');
        const pasteControls = document.getElementById('pasteControls');
        const inputControls = document.getElementById('inputControls');
        const pasteClipboardBtn = document.getElementById('pasteClipboardBtn');
        const highlightBtn = document.getElementById('highlightBtn');

        let currentText = '';
        let currentMatches = [];
        let currentMode = 'paste'; // 'paste' 或 'input'

        function getPlainContent(element) {
            return element.innerText || element.textContent || '';
        }

        function testRegex() {
            const pattern = patternInput.value;
            const flags = flagsInput.value || '';

            // 只有在非组合状态下才更新文本内容
            if (!isComposing) {
                currentText = getPlainContent(textEditor);
            }

            if (!pattern) {
                statusDiv.textContent = 'Please enter a regex pattern';
                return;
            }

            statusDiv.textContent = 'Testing...';

            vscode.postMessage({
                command: 'testRegex',
                pattern: pattern.trim(),
                text: currentText,
                flags: flags
            });
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function applyHighlights(matches) {
            // 如果正在使用输入法组合，延迟高亮更新，避免干扰输入
            if (isComposing) {
                return;
            }

            // 智能判断是否需要更新：只有在真正需要高亮时才进行DOM操作
            const hasExistingHighlights = hasHighlights(textEditor);
            const shouldAddHighlights = matches && matches.length > 0 && currentText;

            // 如果没有高亮且不需要高亮，就不做任何操作
            if (!hasExistingHighlights && !shouldAddHighlights) {
                // 检查内容是否同步
                const currentContent = textEditor.textContent;
                if (currentContent !== currentText) {
                    textEditor.textContent = currentText;
                }
                return;
            }

            // 保存当前光标位置
            const cursorOffset = getCursorOffset(textEditor);

            // 只有在以下情况下才进行DOM重建：
            // 1. 从无高亮变为有高亮
            // 2. 从有高亮变为无高亮
            // 3. 高亮内容发生变化

            // 构建HTML
            let html = '';
            if (!matches || matches.length === 0 || !currentText) {
                html = escapeHtml(currentText || '');
            } else {
                let lastEnd = 0;
                matches.forEach((match) => {
                    html += escapeHtml(currentText.substring(lastEnd, match.start));
                    html += '<span class="highlight">' + escapeHtml(match.text) + '</span>';
                    lastEnd = match.end;
                });
                html += escapeHtml(currentText.substring(lastEnd));
            }

            // 应用高亮HTML
            textEditor.innerHTML = html;

            // 精确恢复光标位置
            restoreCursorFromTextOffset(textEditor, cursorOffset);
        }

        function hasHighlights(element) {
            return element.querySelectorAll('.highlight').length > 0;
        }

        function getTextOffsetFromRange(range) {
            // 从范围计算文本偏移的简单方法
            try {
                const tempRange = range.cloneRange();
                tempRange.selectNodeContents(textEditor);
                tempRange.setEnd(range.startContainer, range.startOffset);
                return tempRange.toString().length;
            } catch (e) {
                return 0;
            }
        }

        
        function getCursorOffset(element) {
            const selection = window.getSelection();
            if (!selection.rangeCount) return 0;

            const range = selection.getRangeAt(0);
            const preCaretRange = range.cloneRange();
            preCaretRange.selectNodeContents(element);
            preCaretRange.setEnd(range.endContainer, range.endOffset);

            // 获取精确的文本内容，包括换行符
            const walker = document.createTreeWalker(
                element,
                NodeFilter.SHOW_TEXT,
                null,
                false
            );

            let text = '';
            let currentNode = null;
            let foundTarget = false;

            while ((currentNode = walker.nextNode())) {
                if (currentNode === range.endContainer) {
                    text += currentNode.textContent.substring(0, range.endOffset);
                    foundTarget = true;
                    break;
                } else {
                    text += currentNode.textContent;
                }
            }

            // 如果没有找到目标节点，使用原始方法作为后备
            if (!foundTarget) {
                return preCaretRange.toString().length;
            }

            return text.length;
        }

        function restoreCursorFromTextOffset(element, textOffset) {
            // 如果正在使用输入法组合，不恢复光标位置，避免干扰输入法
            if (isComposing) {
                return;
            }

            try {
                const selection = window.getSelection();
                selection.removeAllRanges();

                const newRange = createRangeAtTextOffset(element, textOffset, textOffset);

                if (newRange && document.activeElement === element) {
                    selection.addRange(newRange);
                }
            } catch (e) {
                console.warn('Failed to restore cursor:', e);
            }
        }

        function fallbackCursorRestore(element) {
            try {
                // 将光标设置到元素末尾
                const fallbackRange = document.createRange();
                const selection = window.getSelection();
                const textNodes = element.querySelectorAll('#textEditor > *');

                if (textNodes.length > 0) {
                    // 如果有子节点，定位到最后一个子节点
                    const lastChild = textNodes[textNodes.length - 1];
                    fallbackRange.selectNodeContents(lastChild);
                    fallbackRange.collapse(false);
                } else {
                    // 否则定位到整个元素
                    fallbackRange.selectNodeContents(element);
                    fallbackRange.collapse(false);
                }

                selection.removeAllRanges();
                if (document.activeElement === element) {
                    selection.addRange(fallbackRange);
                }
            } catch (e) {
                console.warn('Fallback cursor restore failed:', e);
            }
        }

        function restoreSelection(element, savedRange) {
            // 如果正在使用输入法组合，不恢复光标位置，避免干扰输入法
            if (isComposing) {
                console.log('Skipping cursor restoration during IME composition');
                return;
            }

            // 确保DOM已经更新
            requestAnimationFrame(() => {
                // 再次检查输入法状态，确保不会干扰组合过程
                if (isComposing) {
                    console.log('Skipping cursor restoration - IME composition started during frame');
                    return;
                }

                try {
                    // 计算保存的选择在纯文本中的位置
                    const startOffset = getTextOffset(element, savedRange.startContainer, savedRange.startOffset);
                    const endOffset = savedRange.collapsed ? startOffset : getTextOffset(element, savedRange.endContainer, savedRange.endOffset);

                    // 在新的DOM结构中恢复选择
                    const newRange = createRangeAtTextOffset(element, startOffset, endOffset);

                    if (newRange) {
                        const selection = window.getSelection();
                        selection.removeAllRanges();

                        // 只有当元素仍然有焦点时才恢复选择
                        if (document.activeElement === element) {
                            selection.addRange(newRange);
                        }
                    }
                } catch (e) {
                    // 如果恢复失败，将光标设置到元素末尾
                    console.warn('Failed to restore cursor position:', e);
                    const fallbackRange = document.createRange();
                    const selection = window.getSelection();
                    fallbackRange.selectNodeContents(element);
                    fallbackRange.collapse(false);
                    selection.removeAllRanges();
                    selection.addRange(fallbackRange);
                }
            });
        }

        function getTextOffset(element, container, offset) {
            const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
            let textOffset = 0;
            let currentNode = null;

            while ((currentNode = walker.nextNode())) {
                if (currentNode === container) {
                    return textOffset + offset;
                }
                textOffset += currentNode.textContent.length;
            }
            return textOffset;
        }

        function createRangeAtTextOffset(element, startOffset, endOffset) {
            const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
            let currentOffset = 0;
            let startNode = null, startNodeOffset = 0;
            let endNode = null, endNodeOffset = 0;
            let currentNode = null;

            while ((currentNode = walker.nextNode())) {
                const nodeLength = currentNode.textContent.length;

                // 找到开始位置
                if (!startNode && currentOffset + nodeLength >= startOffset) {
                    startNode = currentNode;
                    startNodeOffset = startOffset - currentOffset;
                }

                // 找到结束位置
                if (currentOffset + nodeLength >= endOffset) {
                    endNode = currentNode;
                    endNodeOffset = endOffset - currentOffset;
                    break;
                }

                currentOffset += nodeLength;
            }

            if (startNode && endNode) {
                const range = document.createRange();
                range.setStart(startNode, startNodeOffset);
                range.setEnd(endNode, endNodeOffset);
                return range;
            }

            return null;
        }

        window.addEventListener('message', event => {
            const message = event.data;

            switch (message.command) {
                case 'showMatches':
                    currentMatches = message.matches;
                    applyHighlights(currentMatches);
                    statusDiv.textContent = 'Found ' + currentMatches.length + ' match(es)';
                    break;

                case 'showError':
                    statusDiv.textContent = 'Error: ' + message.error;
                    break;

                case 'loadLastRegex':
                    patternInput.value = message.pattern;
                    flagsInput.value = message.flags;
                    break;
            }
        });

        // 实时测试（简化）
        patternInput.addEventListener('input', () => {
            if (!isComposing && patternInput.value && currentText) {
                testRegex();
            }
        });

        flagsInput.addEventListener('change', () => {
            // 切换标志时，只要有正则表达式和文本内容就重新测试
            if (patternInput.value && currentText) {
                testRegex();
            } else if (patternInput.value && !currentText) {
                // 如果没有文本内容但有正则表达式，也要更新状态
                statusDiv.textContent = 'Enter text to test against the regex';
            }
        });

        // 模式切换功能
        function switchMode(mode) {
            currentMode = mode;

            if (mode === 'paste') {
                pasteModeBtn.classList.add('active');
                inputModeBtn.classList.remove('active');
                pasteControls.style.display = 'flex';
                inputControls.style.display = 'none';
                textEditor.placeholder = '点击粘贴按钮或直接输入文本...';
            } else {
                inputModeBtn.classList.add('active');
                pasteModeBtn.classList.remove('active');
                inputControls.style.display = 'flex';
                pasteControls.style.display = 'none';
                textEditor.placeholder = '输入文本后点击高亮显示按钮...';
            }
        }

        // 模式切换按钮事件
        pasteModeBtn.addEventListener('click', () => {
            if (currentMode !== 'paste') {
                switchMode('paste');
            }
        });

        inputModeBtn.addEventListener('click', () => {
            if (currentMode !== 'input') {
                switchMode('input');
            }
        });

        // 粘贴剪切板按钮事件
        pasteClipboardBtn.addEventListener('click', async () => {
            try {
                const text = await navigator.clipboard.readText();
                if (text) {
                    // 清空当前内容
                    textEditor.textContent = '';
                    currentText = '';

                    // 设置新内容
                    textEditor.textContent = text;
                    currentText = text;

                    // 如果有正则表达式，自动执行高亮
                    if (patternInput.value) {
                        testRegex();
                    }

                    statusDiv.textContent = '已粘贴剪切板内容';
                } else {
                    statusDiv.textContent = '剪切板为空';
                }
            } catch (error) {
                statusDiv.textContent = '无法读取剪切板内容: ' + error.message;
            }
        });

        // 高亮显示按钮事件（输入模式）
        highlightBtn.addEventListener('click', () => {
            currentText = getPlainContent(textEditor);
            if (patternInput.value && currentText) {
                testRegex();
            } else if (!patternInput.value) {
                statusDiv.textContent = '请先输入正则表达式';
            } else if (!currentText) {
                statusDiv.textContent = '请先输入测试文本';
            }
        });

        // 简化的输入法状态跟踪
        let isComposing = false;

        // 大幅减少高亮更新频率，只在停止输入后才触发
        let textInputTimeout;
        let lastTextContent = '';
        textEditor.addEventListener('input', () => {
            // 如果正在使用输入法组合，不触发任何更新
            if (isComposing) {
                return;
            }

            // 立即更新文本内容
            currentText = getPlainContent(textEditor);

            // 根据当前模式决定是否自动高亮
            if (currentMode === 'paste') {
                // 粘贴模式：自动高亮（保持原有逻辑，但延迟时间缩短）
                if (patternInput.value && currentText !== lastTextContent) {
                    clearTimeout(textInputTimeout);
                    textInputTimeout = setTimeout(() => {
                        testRegex();
                        lastTextContent = currentText;
                    }, 500); // 缩短延迟，提高响应性
                }
            } else {
                // 输入模式：不自动高亮，等待用户点击按钮
                lastTextContent = currentText; // 更新最后内容，但不执行测试
            }
        });

        // 简化的输入法处理
        textEditor.addEventListener('compositionstart', (event) => {
            isComposing = true;
        });

        textEditor.addEventListener('compositionend', (event) => {
            isComposing = false;
            // 输入法结束后延迟更新，让输入法稳定
            setTimeout(() => {
                currentText = getPlainContent(textEditor);
                if (patternInput.value) {
                    testRegex();
                }
            }, 100);
        });

        // 正则表达式输入框的输入法监听
        patternInput.addEventListener('compositionstart', (event) => {
            isComposing = true;
        });

        patternInput.addEventListener('compositionend', (event) => {
            isComposing = false;
            if (currentText) {
                testRegex();
            }
        });

        // 防抖保存当前正则表达式
        let saveTimeout;
        patternInput.addEventListener('keyup', () => {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                if (patternInput.value.trim()) {
                    const flags = flagsInput.value || 'g';
                    vscode.postMessage({
                        command: 'saveRegex',
                        pattern: patternInput.value.trim(),
                        flags: flags
                    });
                }
            }, 1000);
        });

        flagsInput.addEventListener('change', () => {
            if (patternInput.value.trim()) {
                const flags = flagsInput.value || '';
                vscode.postMessage({
                    command: 'saveRegex',
                    pattern: patternInput.value.trim(),
                    flags: flags
                });
            }
        });

        // 初始化
        currentText = '';
        textEditor.innerHTML = '';
    </script>
</body>
</html>`;
}

export function deactivate() {}