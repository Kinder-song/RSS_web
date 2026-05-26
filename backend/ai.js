import axios from 'axios';

const MINIMAX_API_URL = 'https://api.minimax.chat/v1/text/chatcompletion_pro';

export async function generateSummary(text, apiKey, retries = 2) {
    if (!apiKey) {
        return truncateText(text, 300);
    }
    let lastError;
    for (let i = 0; i <= retries; i++) {
        try {
            const response = await axios.post(MINIMAX_API_URL, {
                model: 'MiniMax-Text-01',
                messages: [{
                    role: 'user',
                    content: `请为以下文章生成一段200-300字的中文摘要，要求语言精炼、信息完整、适合阅读：\n\n${text.substring(0, 3000)}`
                }],
                max_tokens: 400
            }, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 15000
            });
            return response.data.choices[0].message.content.trim();
        } catch (error) {
            lastError = error;
            if (i < retries) {
                await new Promise(r => setTimeout(r, 1000 * (i + 1)));
            }
        }
    }
    console.error('MiniMax API error after retries:', lastError.message);
    return truncateText(text, 200);
}

function truncateText(text, maxLen) {
    if (!text || text.length <= maxLen) return text || '';
    const stripped = text.replace(/<[^>]*>/g, '');
    if (stripped.length <= maxLen) return stripped;
    const sliced = stripped.slice(0, maxLen);
    // Find last valid character boundary for CJK (memory efficient - no array copy)
    let lastValid = sliced.length;
    for (let i = sliced.length - 1; i >= 0; i--) {
        if (/[一-龥a-zA-Z0-9]/.test(sliced[i])) {
            lastValid = i + 1;
            break;
        }
    }
    return sliced.slice(0, lastValid) + '…';
}
