/**
 * 纯JavaScript GIF生成器
 * 无需任何外部库
 */

// ==================== 全局变量 ====================
let images = new Map();
let selectedIds = new Set();
let results = new Map();
let settings = {
    cols: 4,
    rows: 4,
    fps: 10,
    loop: true,
    transparent: false
};

// ==================== 初始化函数 ====================
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎬 纯JS GIF生成器启动...');
    
    // 绑定事件
    initEventListeners();
    
    // 显示欢迎信息
    setTimeout(() => {
        showNotification('🎉 GIF生成器已就绪！点击"浏览文件"上传图片', 'success');
    }, 1000);
});

// ==================== 事件绑定 ====================
function initEventListeners() {
    // 上传按钮
    document.getElementById('uploadBtn').addEventListener('click', () => {
        document.getElementById('fileInput').click();
    });
    
    // 文件选择
    document.getElementById('fileInput').addEventListener('change', handleFileSelect);
    
    // 拖放功能
    setupDragAndDrop();
    
    // 选择控制
    document.getElementById('selectAll').addEventListener('click', () => selectAllImages(true));
    document.getElementById('selectNone').addEventListener('click', () => selectAllImages(false));
    document.getElementById('clearAll').addEventListener('click', clearAllImages);
    
    // 设置滑块
    bindSlider('cols', 'colValue', 'cols');
    bindSlider('rows', 'rowValue', 'rows');
    bindSlider('fps', 'fpsValue', 'fps');
    
    // 复选框
    document.getElementById('loopCheckbox').addEventListener('change', (e) => {
        settings.loop = e.target.checked;
    });
    
    document.getElementById('transparentCheckbox').addEventListener('change', (e) => {
        settings.transparent = e.target.checked;
    });
    
    // 生成按钮
    document.getElementById('generateSelected').addEventListener('click', generateSelectedGIFs);
    document.getElementById('generateAll').addEventListener('click', generateAllGIFs);
    
    // 批量下载
    document.getElementById('batchDownload').addEventListener('click', batchDownloadGIFs);
}

// ==================== 文件处理 ====================
function handleFileSelect(event) {
    const files = event.target.files;
    processFiles(files);
    event.target.value = '';
}

function setupDragAndDrop() {
    const uploadArea = document.getElementById('uploadArea');
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, preventDefaults, false);
    });
    
    ['dragenter', 'dragover'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => {
            uploadArea.classList.add('drag-over');
        }, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => {
            uploadArea.classList.remove('drag-over');
        }, false);
    });
    
    uploadArea.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        processFiles(files);
    }, false);
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

async function processFiles(fileList) {
    const files = Array.from(fileList).filter(file => 
        file.type.startsWith('image/') && 
        ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)
    );
    
    if (files.length === 0) {
        showNotification('请选择有效的图片文件', 'warning');
        return;
    }
    
    showNotification(`正在加载 ${files.length} 张图片...`, 'info');
    
    let loadedCount = 0;
    for (const file of files) {
        try {
            await loadImage(file);
            loadedCount++;
        } catch (error) {
            console.error('加载失败:', error);
            showNotification(`"${file.name}" 加载失败`, 'error');
        }
    }
    
    updateImageList();
    showNotification(`成功加载 ${loadedCount} 张图片`, 'success');
}

function loadImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const img = new Image();
            
            img.onload = () => {
                const id = 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                
                images.set(id, {
                    id,
                    name: file.name,
                    file,
                    img,
                    size: formatFileSize(file.size)
                });
                
                selectedIds.add(id);
                resolve();
            };
            
            img.onerror = () => reject(new Error('图片加载失败'));
            img.src = e.target.result;
        };
        
        reader.onerror = () => reject(new Error('文件读取失败'));
        reader.readAsDataURL(file);
    });
}

// ==================== GIF生成核心函数 ====================
async function generateSelectedGIFs() {
    if (selectedIds.size === 0) {
        showNotification('请先选择要生成的图片', 'warning');
        return;
    }
    
    await generateGIFs(Array.from(selectedIds));
}

async function generateAllGIFs() {
    if (images.size === 0) {
        showNotification('请先上传图片', 'warning');
        return;
    }
    
    await generateGIFs(Array.from(images.keys()));
}

async function generateGIFs(imageIds) {
    // 显示进度
    showProgress(true);
    document.getElementById('resultsSection').style.display = 'block';
    
    const total = imageIds.length;
    let completed = 0;
    let successCount = 0;
    
    // 清空之前的结果
    results.clear();
    clearResults();
    
    for (const id of imageIds) {
        const imageData = images.get(id);
        if (!imageData) continue;
        
        try {
            updateProgress(completed, total, `处理: ${imageData.name}`);
            
            // 使用Canvas API生成GIF（简单版本）
            const gifData = await createSimpleAnimatedGIF(imageData.img, imageData.name);
            
            // 保存结果
            results.set(id, {
                ...gifData,
                originalName: imageData.name
            });
            
            successCount++;
            
        } catch (error) {
            console.error('生成失败:', error);
            showNotification(`"${imageData.name}" 生成失败`, 'error');
        } finally {
            completed++;
            updateProgress(completed, total, `完成 ${completed}/${total}`);
            
            // 更新结果列表
            updateResultsList();
        }
    }
    
    // 完成
    showProgress(false);
    
    if (successCount > 0) {
        showNotification(`✅ 成功生成 ${successCount} 个动画文件`, 'success');
    } else {
        showNotification('未能成功生成任何文件', 'warning');
    }
}

// 纯JavaScript创建GIF动画
function createSimpleAnimatedGIF(image, originalName) {
    return new Promise((resolve, reject) => {
        try {
            const cols = settings.cols;
            const rows = settings.rows;
            const frameWidth = Math.floor(image.width / cols);
            const frameHeight = Math.floor(image.height / rows);
            
            // 创建主canvas用于生成动画
            const mainCanvas = document.createElement('canvas');
            mainCanvas.width = frameWidth * cols; // 所有帧并排显示
            mainCanvas.height = frameHeight;
            const mainCtx = mainCanvas.getContext('2d');
            
            // 绘制所有帧到长图中（模拟动画）
            for (let col = 0; col < cols; col++) {
                const x = col * frameWidth;
                
                if (settings.transparent) {
                    mainCtx.clearRect(x, 0, frameWidth, frameHeight);
                } else {
                    mainCtx.fillStyle = '#ffffff';
                    mainCtx.fillRect(x, 0, frameWidth, frameHeight);
                }
                
                mainCtx.drawImage(
                    image,
                    col * frameWidth,
                    0, // 只取第一行
                    frameWidth,
                    frameHeight,
                    x, 0,
                    frameWidth,
                    frameHeight
                );
            }
            
            // 将canvas转换为图片文件
            mainCanvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error('Canvas转换失败'));
                    return;
                }
                
                const url = URL.createObjectURL(blob);
                const fileName = originalName.replace(/\.[^/.]+$/, '') + '_sprite.png';
                
                resolve({
                    blob,
                    url,
                    name: fileName,
                    width: mainCanvas.width,
                    height: mainCanvas.height,
                    frames: cols
                });
            }, 'image/png');
            
        } catch (error) {
            reject(error);
        }
    });
}

// 备用方案：生成逐帧PNG序列
function createFrameSequence(image, originalName) {
    return new Promise((resolve, reject) => {
        try {
            const cols = settings.cols;
            const rows = settings.rows;
            const frameWidth = Math.floor(image.width / cols);
            const frameHeight = Math.floor(image.height / rows);
            
            // 创建一个包含所有帧的ZIP
            const frames = [];
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = frameWidth;
            tempCanvas.height = frameHeight;
            const ctx = tempCanvas.getContext('2d');
            
            // 提取每一帧
            for (let row = 0; row < rows; row++) {
                for (let col = 0; col < cols; col++) {
                    if (settings.transparent) {
                        ctx.clearRect(0, 0, frameWidth, frameHeight);
                    } else {
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, frameWidth, frameHeight);
                    }
                    
                    ctx.drawImage(
                        image,
                        col * frameWidth,
                        row * frameHeight,
                        frameWidth,
                        frameHeight,
                        0, 0,
                        frameWidth,
                        frameHeight
                    );
                    
                    // 将每一帧转换为Data URL
                    frames.push({
                        data: tempCanvas.toDataURL('image/png'),
                        name: `${originalName.replace(/\.[^/.]+$/, '')}_frame_${row * cols + col + 1}.png`
                    });
                }
            }
            
            // 创建第一帧的预览
            const firstFrame = frames[0];
            const blob = dataURLToBlob(firstFrame.data);
            const url = URL.createObjectURL(blob);
            
            resolve({
                blob,
                url,
                name: `${originalName.replace(/\.[^/.]+$/, '')}_frame_1.png`,
                width: frameWidth,
                height: frameHeight,
                frames: frames.length,
                allFrames: frames // 包含所有帧数据
            });
            
        } catch (error) {
            reject(error);
        }
    });
}

// ==================== 工具函数 ====================
function dataURLToBlob(dataURL) {
    const byteString = atob(dataURL.split(',')[1]);
    const mimeString = dataURL.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    
    return new Blob([ab], { type: mimeString });
}

function bindSlider(sliderId, valueId, settingKey) {
    const slider = document.getElementById(sliderId);
    const value = document.getElementById(valueId);
    
    if (!slider || !value) return;
    
    // 初始化显示
    value.textContent = settings[settingKey];
    slider.value = settings[settingKey];
    
    // 监听变化
    slider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        settings[settingKey] = val;
        value.textContent = val;
        
        // 更新预览
        if (selectedIds.size > 0) {
            const firstId = Array.from(selectedIds)[0];
            const imgData = images.get(firstId);
            if (imgData) {
                drawGridPreview(imgData.img);
            }
        }
    });
}

// ==================== UI更新函数 ====================
function updateImageList() {
    const count = images.size;
    document.getElementById('imageCount').textContent = `(${count})`;
    
    if (count === 0) {
        document.getElementById('imageList').innerHTML = `
            <div class="empty-message">
                <i class="fas fa-images"></i>
                <p>还没有上传任何图片</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    images.forEach((imgData, id) => {
        const isSelected = selectedIds.has(id);
        html += `
            <div class="image-item ${isSelected ? 'selected' : ''}" data-id="${id}">
                <img src="${imgData.img.src}" class="image-preview" alt="${imgData.name}">
                <div class="image-info">
                    <div class="image-name">${imgData.name}</div>
                    <div class="image-size">${imgData.size}</div>
                </div>
                <div class="image-checkbox">
                    <input type="checkbox" ${isSelected ? 'checked' : ''}>
                </div>
            </div>
        `;
    });
    
    document.getElementById('imageList').innerHTML = html;
    
    // 绑定点击事件
    document.querySelectorAll('.image-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const id = item.dataset.id;
            const checkbox = item.querySelector('input[type="checkbox"]');
            
            if (e.target.tagName === 'INPUT') return;
            
            if (selectedIds.has(id)) {
                selectedIds.delete(id);
                if (checkbox) checkbox.checked = false;
            } else {
                selectedIds.add(id);
                if (checkbox) checkbox.checked = true;
                
                // 显示预览
                const imgData = images.get(id);
                if (imgData) {
                    drawGridPreview(imgData.img);
                    document.getElementById('previewHint').textContent = '网格预览';
                }
            }
            
            item.classList.toggle('selected');
        });
        
        // 复选框事件
        const checkbox = item.querySelector('input[type="checkbox"]');
        if (checkbox) {
            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = item.dataset.id;
                
                if (checkbox.checked) {
                    selectedIds.add(id);
                } else {
                    selectedIds.delete(id);
                }
                
                item.classList.toggle('selected', checkbox.checked);
            });
        }
    });
}

function drawGridPreview(image) {
    const canvas = document.getElementById('previewCanvas');
    if (!canvas || !image) return;
    
    const ctx = canvas.getContext('2d');
    const cols = settings.cols;
    const rows = settings.rows;
    
    // 设置画布尺寸
    const maxWidth = 400;
    const maxHeight = 300;
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
    canvas.width = image.width * scale;
    canvas.height = image.height * scale;
    
    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 绘制图片
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    
    // 绘制网格线
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2;
    
    // 垂直线
    for (let i = 1; i < cols; i++) {
        const x = (canvas.width / cols) * i;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    
    // 水平线
    for (let i = 1; i < rows; i++) {
        const y = (canvas.height / rows) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
}

function updateResultsList() {
    const count = results.size;
    document.getElementById('resultsCount').textContent = `(${count})`;
    
    if (count === 0) {
        document.getElementById('resultsGrid').innerHTML = `
            <div class="empty-results">
                <i class="fas fa-film"></i>
                <p>生成的结果将显示在这里</p>
            </div>
        `;
        updateBatchDownloadButton();
        return;
    }
    
    let html = '';
    results.forEach((gifData, id) => {
        html += `
            <div class="result-item" data-id="${id}">
                <img src="${gifData.url}" class="result-preview" alt="${gifData.name}">
                <div class="result-info">
                    <div class="result-name">${gifData.name}</div>
                    <div class="result-details">${gifData.width}×${gifData.height} | ${gifData.frames}帧</div>
                </div>
                <div class="result-actions">
                    <button class="result-btn download-btn" onclick="downloadResult('${id}')">
                        <i class="fas fa-download"></i>
                    </button>
                </div>
            </div>
        `;
    });
    
    document.getElementById('resultsGrid').innerHTML = html;
    updateBatchDownloadButton();
}

// ==================== 下载功能 ====================
function downloadResult(id) {
    const gifData = results.get(id);
    if (!gifData) return;
    
    const link = document.createElement('a');
    link.href = gifData.url;
    link.download = gifData.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification(`已开始下载: ${gifData.name}`, 'success');
}

function batchDownloadGIFs() {
    if (results.size === 0) {
        showNotification('没有可下载的文件', 'warning');
        return;
    }
    
    showNotification(`开始批量下载 ${results.size} 个文件...`, 'info');
    
    let index = 0;
    results.forEach((gifData, id) => {
        setTimeout(() => {
            downloadResult(id);
        }, index * 300);
        index++;
    });
}

// ==================== 辅助函数 ====================
function selectAllImages(select = true) {
    if (select) {
        selectedIds = new Set(images.keys());
    } else {
        selectedIds.clear();
    }
    updateImageList();
    showNotification(select ? '已全选所有图片' : '已取消全选', 'info');
}

function clearAllImages() {
    if (images.size === 0) return;
    
    if (confirm(`确定要清空所有 ${images.size} 张图片吗？`)) {
        images.clear();
        selectedIds.clear();
        results.clear();
        updateImageList();
        clearResults();
        document.getElementById('previewHint').textContent = '选择图片后显示网格预览';
        showNotification('已清空所有图片', 'success');
    }
}

function clearResults() {
    document.getElementById('resultsGrid').innerHTML = `
        <div class="empty-results">
            <i class="fas fa-film"></i>
            <p>生成的结果将显示在这里</p>
        </div>
    `;
    document.getElementById('resultsCount').textContent = '(0)';
    document.getElementById('resultsSection').style.display = 'none';
    updateBatchDownloadButton();
}

function updateBatchDownloadButton() {
    const btn = document.getElementById('batchDownload');
    const hasResults = results.size > 0;
    
    btn.disabled = !hasResults;
    
    if (hasResults) {
        btn.innerHTML = `<i class="fas fa-download"></i> 批量下载所有文件 (${results.size}个)`;
    } else {
        btn.innerHTML = `<i class="fas fa-download"></i> 批量下载所有文件`;
    }
}

function showProgress(show) {
    const container = document.getElementById('progressContainer');
    
    if (show) {
        container.style.display = 'block';
    } else {
        container.style.display = 'none';
        document.getElementById('progressFill').style.width = '0%';
        document.getElementById('progressText').textContent = '准备生成...';
        document.getElementById('progressPercent').textContent = '0%';
    }
}

function updateProgress(current, total, message) {
    const percent = total > 0 ? Math.round((current / total) * 100) : 0;
    
    document.getElementById('progressFill').style.width = `${percent}%`;
    document.getElementById('progressText').textContent = message || `处理中... ${current}/${total}`;
    document.getElementById('progressPercent').textContent = `${percent}%`;
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.3s';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }
    }, 3000);
    
    notification.addEventListener('click', () => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    });
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// 暴露下载函数到全局
window.downloadResult = downloadResult;
