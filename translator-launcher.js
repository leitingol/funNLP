// translator-launcher.js - 智能翻译工具完整代码
// 自动检测最佳词典源（多CDN优化版）
const DICTIONARY_SOURCES = [
    'https://cdn.jsdelivr.net/gh/fighting41love/funNLP@master/data/%E4%B8%AD%E8%8B%B1%E6%96%87%E8%AF%8D%E5%85%B8/english_dictionary.json',
    'https://gitee.com/fighting41love/funNLP/raw/master/data/%E4%B8%AD%E8%8B%B1%E6%96%87%E8%AF%8D%E5%85%B8/english_dictionary.json',
    'https://ghproxy.com/https://raw.githubusercontent.com/fighting41love/funNLP/master/data/%E4%B8%AD%E8%8B%B1%E6%96%87%E8%AF%8D%E5%85%B8/english_dictionary.json',
    'https://raw.githubusercontent.com/fighting41love/funNLP/master/data/%E4%B8%AD%E8%8B%B1%E6%96%87%E8%AF%8D%E5%85%B8/english_dictionary.json'
];

// 智能词典管理器
class DictionaryManager {
    constructor() {
        this.dictionary = {};
        this.cacheKey = 'translator-dict-cache';
        this.cacheTimeKey = 'translator-dict-time';
        this.cacheExpiry = 24 * 60 * 60 * 1000; // 24小时
    }

    async loadDictionary() {
        // 先检查缓存
        const cached = this.getCachedDictionary();
        if (cached) {
            this.dictionary = cached;
            return true;
        }

        // 并行尝试多个源，提高成功率
        const loadPromises = DICTIONARY_SOURCES.map(source => 
            this.tryLoadSource(source)
        );

        // 等待第一个成功的加载
        for (let i = 0; i < loadPromises.length; i++) {
            try {
                const result = await Promise.race(loadPromises.map(p => 
                    p.then(value => ({status: 'fulfilled', value}))
                    .catch(reason => ({status: 'rejected', reason}))
                ));

                if (result.status === 'fulfilled' && result.value) {
                    this.dictionary = result.value;
                    this.cacheDictionary(result.value);
                    return true;
                }
            } catch (e) {
                console.log(`尝试源 ${i} 失败:`, e);
            }
        }

        // 所有源都失败，使用内置基础词典
        this.dictionary = this.getEnhancedBasicDictionary();
        return false;
    }

    async tryLoadSource(source) {
        return new Promise(async (resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`加载超时: ${source}`));
            }, 10000); // 10秒超时

            try {
                const dict = await this.fetchDictionary(source);
                clearTimeout(timeout);
                resolve(dict);
            } catch (e) {
                clearTimeout(timeout);
                reject(e);
            }
        });
    }

    async fetchDictionary(url) {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');
        return await response.json();
    }

    getCachedDictionary() {
        try {
            const cached = localStorage.getItem(this.cacheKey);
            const cacheTime = localStorage.getItem(this.cacheTimeKey);
            
            if (cached && cacheTime) {
                const age = Date.now() - parseInt(cacheTime);
                if (age < this.cacheExpiry) {
                    return JSON.parse(cached);
                }
            }
        } catch (e) {
            console.warn('Failed to read cache:', e);
        }
        return null;
    }

    cacheDictionary(dict) {
        try {
            localStorage.setItem(this.cacheKey, JSON.stringify(dict));
            localStorage.setItem(this.cacheTimeKey, Date.now().toString());
        } catch (e) {
            console.warn('Failed to cache dictionary:', e);
        }
    }

    getEnhancedBasicDictionary() {
        // 扩展基础词典，包含更多常用词汇
        return {
            "Identify": "识别", "Locate": "定位", "Find": "找到", "Determine": "确定",
            "space": "空间", "area": "区域", "spot": "位置", "point": "点",
            "unoccupied": "未被占用的", "vacant": "空置的", "clear": "清晰的",
            "white": "白色", "beige": "米色", "sink": "水槽", "wall": "墙",
            "floor": "地板", "mirror": "镜子", "left": "左", "right": "右",
            "top": "顶部", "bottom": "底部", "center": "中心", "corner": "角落",
            "object": "物体", "person": "人", "car": "汽车", "building": "建筑",
            "road": "道路", "tree": "树", "sky": "天空", "water": "水",
            "food": "食物", "house": "房子", "room": "房间", "door": "门",
            "window": "窗户", "table": "桌子", "chair": "椅子", "bed": "床",
            "computer": "电脑", "phone": "手机", "book": "书", "paper": "纸",
            "time": "时间", "day": "天", "night": "夜晚", "year": "年",
            "work": "工作", "school": "学校", "home": "家", "city": "城市"
        };
    }

    translateWord(word) {
        const cleanWord = word.toLowerCase().trim();
        return this.dictionary[cleanWord] || this.dictionary[word] || word;
    }
}

// 智能翻译引擎
class SmartTranslator {
    constructor(dictionaryManager) {
        this.dictManager = dictionaryManager;
        this.translationCache = new Map();
    }

    translateText(text) {
        if (this.translationCache.has(text)) {
            return this.translationCache.get(text);
        }

        // 智能分割和翻译
        const sentences = this.splitIntoSentences(text);
        const translatedSentences = sentences.map(sentence => 
            this.translateSentence(sentence)
        );

        const result = translatedSentences.join(' ');
        this.translationCache.set(text, result);
        return result;
    }

    splitIntoSentences(text) {
        // 智能句子分割，考虑英文标点
        return text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
    }

    translateSentence(sentence) {
        const words = this.tokenizeSentence(sentence);
        const translatedWords = words.map(word => {
            // 处理短语和复合词
            if (this.isPreposition(word)) return this.dictManager.translateWord(word);
            
            // 智能处理名词短语
            const phrase = this.tryFindPhrase(words, word);
            if (phrase) {
                return this.translatePhrase(phrase);
            }
            
            return this.dictManager.translateWord(word);
        });

        return this.reconstructSentence(translatedWords);
    }

    tokenizeSentence(sentence) {
        // 智能分词，保留标点
        return sentence.match(/[\w']+|[^\w\s]/g) || [];
    }

    isPreposition(word) {
        const prepositions = ['on', 'at', 'in', 'of', 'to', 'for', 'with', 'by', 'from'];
        return prepositions.includes(word.toLowerCase());
    }

    tryFindPhrase(words, currentWord) {
        const index = words.indexOf(currentWord);
        if (index === -1) return null;

        // 尝试匹配2-3个词的短语
        for (let length = 3; length >= 2; length--) {
            if (index + length <= words.length) {
                const phrase = words.slice(index, index + length).join(' ');
                if (this.dictManager.dictionary[phrase]) {
                    return phrase;
                }
            }
        }
        return null;
    }

    translatePhrase(phrase) {
        return this.dictManager.translateWord(phrase) || phrase;
    }

    reconstructSentence(words) {
        return words.join(' ').replace(/\s+([.,!?])/g, '$1');
    }
}

// 离线检测和降级处理
class OfflineTranslator extends SmartTranslator {
    constructor(dictionaryManager) {
        super(dictionaryManager);
        this.isOnline = navigator.onLine;
        this.setupOfflineDetection();
    }

    setupOfflineDetection() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            console.log('网络连接恢复');
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            console.log('网络连接断开，使用离线模式');
        });
    }

    async translateText(text) {
        if (!this.isOnline && !this.translationCache.has(text)) {
            console.warn('离线模式下，使用缓存和基础词典翻译');
        }
        return super.translateText(text);
    }
}

// 主界面管理器
class TranslatorUI {
    constructor(translator) {
        this.translator = translator;
        this.container = null;
    }

    createUI() {
        this.container = document.createElement('div');
        this.container.innerHTML = `
            <div style="position:fixed;top:50px;right:20px;width:500px;background:white;border:2px solid #28a745;border-radius:8px;z-index:2147483647;box-shadow:0 5px 20px rgba(0,0,0,0.2);font-family:Microsoft YaHei,sans-serif;">
                <div style="padding:12px;background:#28a745;color:white;display:flex;justify-content:space-between;align-items:center;">
                    <strong>🔧 智能翻译工具</strong>
                    <button style="background:none;border:none;color:white;font-size:18px;cursor:pointer;">×</button>
                </div>
                <div style="padding:15px;">
                    <div id="trans-status" style="background:#e7f7ed;padding:10px;border-radius:4px;margin-bottom:15px;">
                        <div>⏳ 正在加载词典...</div>
                        <div style="font-size:12px;color:#666;" id="progress-text">初始化中</div>
                    </div>
                    <div id="trans-results" style="display:none;">
                        <h4 style="color:#28a745;margin:0 0 10px 0;">✅ 翻译结果</h4>
                        <div style="background:#f8f9fa;padding:10px;border-radius:4px;margin-bottom:10px;min-height:60px;" id="result-text"></div>
                        <button style="background:#28a745;color:white;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;width:100%;">复制译文</button>
                    </div>
                    <div id="trans-error" style="display:none;background:#f8d7da;color:#721c24;padding:10px;border-radius:4px;text-align:center;">
                        <strong>❌ 翻译失败</strong>
                        <div style="font-size:12px;" id="error-message"></div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(this.container);
        this.bindEvents();
        return this.container;
    }

    bindEvents() {
        // 关闭按钮
        this.container.querySelector('button').onclick = () => {
            this.container.remove();
        };

        // 复制按钮
        this.container.querySelector('#trans-results button').onclick = () => {
            this.copyTranslation();
        };
    }

    updateStatus(text, subtext = '') {
        const statusEl = this.container.querySelector('#trans-status');
        const progressEl = this.container.querySelector('#progress-text');
        
        statusEl.innerHTML = `<div>${text}</div>`;
        if (subtext) {
            progressEl.textContent = subtext;
        }
    }

    showResults(translation, original) {
        this.container.querySelector('#trans-status').style.display = 'none';
        this.container.querySelector('#trans-results').style.display = 'block';
        
        const resultEl = this.container.querySelector('#result-text');
        resultEl.innerHTML = `
            <div style="margin-bottom:8px;"><strong>原文:</strong> ${original}</div>
            <div style="color:#28a745;"><strong>译文:</strong> ${translation}</div>
        `;
    }

    showError(message) {
        this.container.querySelector('#trans-status').style.display = 'none';
        this.container.querySelector('#trans-error').style.display = 'block';
        this.container.querySelector('#error-message').textContent = message;
    }

    copyTranslation() {
        const resultEl = this.container.querySelector('#result-text');
        const translation = resultEl.textContent.split('译文:')[1]?.trim();
        
        if (translation) {
            navigator.clipboard.writeText(translation).then(() => {
                this.showMessage('✅ 已复制到剪贴板');
            }).catch(() => {
                this.showMessage('❌ 复制失败');
            });
        }
    }

    showMessage(text) {
        const message = document.createElement('div');
        message.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#333;color:white;padding:10px 15px;border-radius:4px;z-index:2147483647;';
        message.textContent = text;
        document.body.appendChild(message);
        setTimeout(() => message.remove(), 2000);
    }
}

// 增强的初始化函数
async function initTranslator() {
    const ui = new TranslatorUI();
    const container = ui.createUI();
    
    try {
        // 分阶段进度提示
        const progressSteps = [
            {text: '检查本地缓存...', delay: 300},
            {text: '尝试连接词典源...', delay: 500},
            {text: '加载翻译引擎...', delay: 200}
        ];
        
        for (const step of progressSteps) {
            ui.updateStatus('⏳ 正在初始化', step.text);
            await new Promise(resolve => setTimeout(resolve, step.delay));
        }
        
        const dictManager = new DictionaryManager();
        ui.updateStatus('⏳ 正在加载词典', '从网络获取最新词典...');
        
        const success = await dictManager.loadDictionary();
        if (success) {
            ui.updateStatus('✅ 词典加载完成', `已加载 ${Object.keys(dictManager.dictionary).length} 个词条`);
        } else {
            ui.updateStatus('⚠️ 使用基础词典', '网络加载失败，使用内置词典');
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const translator = new OfflineTranslator(dictManager);
        ui.translator = translator;
        
        ui.updateStatus('🔍 正在提取文本', '分析页面内容...');
        
        const text = extractTextFromPage();
        if (!text) {
            ui.showError('未找到可翻译的文本内容');
            return;
        }
        
        ui.updateStatus('🔄 正在翻译', '智能分析中...');
        await new Promise(resolve => setTimeout(resolve, 800));
        
        const translation = translator.translateText(text);
        ui.showResults(translation, text);
        
    } catch (error) {
        console.error('Translation error:', error);
        ui.showError(`翻译失败: ${error.message}`);
    }
}

// 页面文本提取
function extractTextFromPage() {
    // 多种方式尝试提取文本
    const selectors = [
        '.content',
        '.main',
        '.article',
        '.post',
        '.text',
        'article',
        'main',
        'p',
        'body'
    ];
    
    for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
            const text = element.textContent || element.innerText;
            if (text && text.trim().length > 10) {
                return text.trim().substring(0, 500); // 限制长度
            }
        }
    }
    
    // 如果没有找到合适的内容，尝试从body提取
    const bodyText = document.body.textContent || document.body.innerText;
    if (bodyText && bodyText.trim().length > 10) {
        return bodyText.trim().substring(0, 500);
    }
    
    return null;
}

// 启动翻译工具
initTranslator();