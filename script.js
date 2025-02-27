document.addEventListener('DOMContentLoaded', function() {
    const canvas = document.getElementById('drawingCanvas');
    const ctx = canvas.getContext('2d');
    const colorPicker = document.getElementById('colorPicker');
    const brushSize = document.getElementById('brushSize');
    const brushSizeLabel = document.getElementById('brushSizeLabel');
    
    // State variables
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;
    let currentTool = 'pen';
    let currentColor = '#000000';
    let currentPage = 0;
    let pages = [[]];
    let undoStack = [[]];
    let redoStack = [[]];
    let currentBrushStyle = 'normal';
    let isDrawingShape = false;
    let currentShape = null;
    let startX = 0;
    let startY = 0;
    let originalCanvasState = null;
    let currentLineStyle = 'solid';
    let highlighterColor = null;
    let textElements = {
        0: [] // Initialize for first page
    };
    let isDraggingText = false;
    let currentDraggedText = null;
    let textOffset = { x: 0, y: 0 };
    let currentEditingText = null;

    // Tool elements
    const tools = {
        pen: document.getElementById('penTool'),
        highlighter: document.getElementById('highlighterTool'),
        eraser: document.getElementById('eraserTool'),
        text: document.getElementById('textTool')
    };

    // Add PDF viewer functionality
    let pdfDoc = null;
    let currentPDFPage = 1;
    let pdfScale = 1.5;
    let pdfAnnotations = {};
    let isPDFDrawing = false;
    let lastPDFX = 0;
    let lastPDFY = 0;
    let currentPDFTool = 'pen';

    // Add zoom functionality
    let zoomLevel = 1;
    const MIN_ZOOM = 0.5;
    const MAX_ZOOM = 2;
    const ZOOM_STEP = 0.1;

    // Initialize canvas
    function resizeCanvas() {
        if (document.querySelector('.container').classList.contains('fullscreen')) {
            // Keep original dimensions in fullscreen
            canvas.width = 1200; // Increased width
            canvas.height = 1600; // Increased height
            canvas.style.width = '1200px';
            canvas.style.height = '1600px';
        } else {
            // Normal mode
            canvas.style.width = '1200px'; // Increased width
            canvas.style.height = '1600px'; // Increased height
            canvas.width = 1200; // Increased width
            canvas.height = 1600; // Increased height
        }
        redraw();
    }

    function saveState() {
        const imageData = canvas.toDataURL();
        undoStack[currentPage].push(imageData);
        redoStack[currentPage] = [];
        updateUndoRedoButtons();
        updatePageThumbnails();
    }

    function redraw() {
        if (undoStack[currentPage].length > 0) {
            const img = new Image();
            img.src = undoStack[currentPage][undoStack[currentPage].length - 1];
            img.onload = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);
            };
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    // Tool switching
    Object.entries(tools).forEach(([toolName, element]) => {
        element.addEventListener('click', () => {
            currentTool = toolName;
            const textLayer = document.querySelector('.text-layer');
            textLayer.classList.remove('text-active');
            
            // Deselect all text elements when switching tools
            document.querySelectorAll('.draggable-text').forEach(el => {
                el.classList.remove('selected');
            });
            
            Object.values(tools).forEach(tool => tool.classList.remove('active'));
            element.classList.add('active');
        });
    });

    // Brush size handling
    document.getElementById('brushSizeFullscreen').addEventListener('input', (e) => {
        const size = e.target.value;
        brushSize.value = size;
        document.getElementById('brushSizeLabel').textContent = `${size}px`;
        document.getElementById('brushSizeLabelFullscreen').textContent = `${size}px`;
    });

    // Update normal brush size handler to sync with fullscreen
    brushSize.addEventListener('input', (e) => {
        const size = e.target.value;
        document.getElementById('brushSizeLabel').textContent = `${size}px`;
        document.getElementById('brushSizeLabelFullscreen').value = size;
        document.getElementById('brushSizeLabelFullscreen').textContent = `${size}px`;
    });

    // Color buttons
    document.querySelectorAll('.color-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentColor = btn.dataset.color;
            colorPicker.value = currentColor;
            document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    colorPicker.addEventListener('input', (e) => {
        currentColor = e.target.value;
        document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
    });

    // Brush styles
    document.querySelectorAll('.brush-style').forEach(btn => {
        btn.addEventListener('click', () => {
            currentBrushStyle = btn.dataset.brush;
            document.querySelectorAll('.brush-style').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    // Shape tools
    document.querySelectorAll('.shape-tool').forEach(btn => {
        btn.addEventListener('click', () => {
            currentShape = btn.dataset.shape;
            currentTool = 'shape';
            Object.values(tools).forEach(tool => tool.classList.remove('active'));
        });
    });

    // Line styles
    document.querySelectorAll('.line-style').forEach(btn => {
        btn.addEventListener('click', () => {
            currentLineStyle = btn.dataset.line;
            document.querySelectorAll('.line-style').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    // Highlighter handlers
    document.querySelectorAll('.highlighter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            highlighterColor = btn.dataset.color;
            currentTool = 'highlighter';
            document.querySelectorAll('.highlighter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            Object.values(tools).forEach(tool => tool.classList.remove('active'));
        });
    });

    // Add theme toggle
    const themeToggle = document.getElementById('themeToggle');
    themeToggle.addEventListener('click', () => {
        document.documentElement.setAttribute('data-theme', 
            document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'
        );
        themeToggle.innerHTML = document.documentElement.getAttribute('data-theme') === 'dark' 
            ? '<i class="fas fa-sun"></i>' 
            : '<i class="fas fa-moon"></i>';
    });

    // Drawing functions
    function startDrawing(e) {
        isDrawing = true;
        let x = e.offsetX;
        let y = e.offsetY;
        
        if (document.querySelector('.container').classList.contains('fullscreen')) {
            const rect = canvas.getBoundingClientRect();
            x = (e.clientX - rect.left) * (canvas.width / rect.width);
            y = (e.clientY - rect.top) * (canvas.height / rect.height);
        }
        
        [lastX, lastY] = [x, y];
        
        if (currentTool === 'shape') {
            [startX, startY] = [x, y];
            originalCanvasState = ctx.getImageData(0, 0, canvas.width, canvas.height);
        }
    }

    function draw(e) {
        if (!isDrawing) return;
        
        let x = e.offsetX;
        let y = e.offsetY;
        
        // Adjust coordinates for fullscreen mode
        if (document.querySelector('.container').classList.contains('fullscreen')) {
            const rect = canvas.getBoundingClientRect();
            x = (e.clientX - rect.left) * (canvas.width / rect.width);
            y = (e.clientY - rect.top) * (canvas.height / rect.height);
        }
        
        if (currentTool === 'shape') {
            drawShape(e);
            return;
        }

        ctx.beginPath();
        ctx.moveTo(lastX, lastY);

        // Set line style
        if (currentLineStyle !== 'solid' && currentTool !== 'highlighter') {
            ctx.setLineDash(getLineDashPattern());
        } else {
            ctx.setLineDash([]);
        }

        // Set special blending for highlighter
        if (currentTool === 'highlighter') {
            ctx.globalCompositeOperation = 'darken';
            ctx.globalAlpha = 0.5;
        } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1.0;
        }

        // Draw based on current tool and style
        if (currentTool === 'highlighter') {
            ctx.lineTo(x, y);
            ctx.strokeStyle = highlighterColor || '#ffeb3b';
            ctx.lineWidth = brushSize.value * 8;
            ctx.lineCap = 'square';
        } else if (currentLineStyle === 'double' && currentTool !== 'eraser') {
            // Double line effect
            const gap = brushSize.value / 2;
            const angle = Math.atan2(y - lastY, x - lastX);
            const perpendicular = angle + Math.PI/2;
            
            // First line
            ctx.beginPath();
            ctx.moveTo(
                lastX + Math.cos(perpendicular) * gap,
                lastY + Math.sin(perpendicular) * gap
            );
            ctx.lineTo(
                x + Math.cos(perpendicular) * gap,
                y + Math.sin(perpendicular) * gap
            );
            ctx.strokeStyle = currentColor;
            ctx.lineWidth = brushSize.value / 2;
            ctx.stroke();
            
            // Second line
            ctx.beginPath();
            ctx.moveTo(
                lastX - Math.cos(perpendicular) * gap,
                lastY - Math.sin(perpendicular) * gap
            );
            ctx.lineTo(
                x - Math.cos(perpendicular) * gap,
                y - Math.sin(perpendicular) * gap
            );
            ctx.stroke();
        } else {
            // Normal drawing
            if (currentBrushStyle === 'rough') {
                for (let i = 0; i < 3; i++) {
                    const offsetX = Math.random() * 4 - 2;
                    const offsetY = Math.random() * 4 - 2;
                    ctx.lineTo(x + offsetX, y + offsetY);
                }
            } else if (currentBrushStyle === 'spray') {
                for (let i = 0; i < 20; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const radius = Math.random() * brushSize.value;
                    ctx.fillStyle = currentColor;
                    ctx.fillRect(
                        x + radius * Math.cos(angle),
                        y + radius * Math.sin(angle),
                        1, 1
                    );
                }
            } else {
                ctx.lineTo(x, y);
            }
            
            if (currentTool === 'eraser') {
                ctx.globalCompositeOperation = 'destination-out';
                ctx.strokeStyle = 'rgba(255,255,255,1)';
                ctx.lineWidth = brushSize.value * 2;
            } else {
                ctx.strokeStyle = currentColor;
                ctx.lineWidth = brushSize.value;
            }
        }

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        
        // Reset settings
        ctx.setLineDash([]);
        ctx.globalAlpha = 1.0;
        ctx.globalCompositeOperation = 'source-over';
        
        [lastX, lastY] = [x, y];
    }

    function stopDrawing() {
        if (isDrawing) {
            isDrawing = false;
            saveState();
        }
    }

    // Page handling
    const pageIndicator = document.getElementById('pageIndicator');
    
    function updatePageThumbnails() {
        const thumbnailsContainer = document.querySelector('.page-thumbnails');
        thumbnailsContainer.innerHTML = '';
        
        pages.forEach((page, index) => {
            const thumbnail = document.createElement('div');
            thumbnail.className = `page-preview${index === currentPage ? ' active' : ''}`;
            
            if (!document.querySelector('.page-sidebar').classList.contains('collapsed')) {
                // Create mini canvas for preview when not collapsed
                const miniCanvas = document.createElement('canvas');
                miniCanvas.width = 150;
                miniCanvas.height = 200;
                const miniCtx = miniCanvas.getContext('2d');
                
                // Fill with white background
                miniCtx.fillStyle = 'white';
                miniCtx.fillRect(0, 0, 150, 200);
                
                if (undoStack[index] && undoStack[index].length > 0) {
                    const img = new Image();
                    img.onload = () => {
                        // Scale to fit preview while maintaining aspect ratio
                        const scale = Math.min(150 / img.width, 200 / img.height);
                        const width = img.width * scale;
                        const height = img.height * scale;
                        const x = (150 - width) / 2;
                        const y = (200 - height) / 2;
                        
                        miniCtx.drawImage(img, x, y, width, height);
                    };
                    img.src = undoStack[index][undoStack[index].length - 1];
                }
                thumbnail.appendChild(miniCanvas);
            }
            
            // Add page number
            const pageNumber = document.createElement('div');
            pageNumber.className = 'page-number';
            pageNumber.textContent = (index + 1).toString();
            thumbnail.appendChild(pageNumber);
            
            thumbnail.addEventListener('click', () => {
                currentPage = index;
                updatePageThumbnails();
                redraw();
            });
            
            thumbnailsContainer.appendChild(thumbnail);
        });
        showPageTexts();
    }

    document.getElementById('sidebarAddPage').addEventListener('click', () => {
        pages.splice(currentPage + 1, 0, []);
        undoStack.splice(currentPage + 1, 0, []);
        redoStack.splice(currentPage + 1, 0, []);
        textElements[currentPage + 1] = [];
        
        currentPage = currentPage + 1;
        
        updatePageThumbnails();
        updateFullscreenPageIndicator();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        saveState();
    });

    // Undo/Redo
    document.getElementById('undoBtn').addEventListener('click', () => {
        if (undoStack[currentPage].length > 1) {
            redoStack[currentPage].push(undoStack[currentPage].pop());
            redraw();
            updateUndoRedoButtons();
        }
    });

    document.getElementById('redoBtn').addEventListener('click', () => {
        if (redoStack[currentPage].length > 0) {
            undoStack[currentPage].push(redoStack[currentPage].pop());
            redraw();
            updateUndoRedoButtons();
        }
    });

    function updateUndoRedoButtons() {
        document.getElementById('undoBtn').disabled = undoStack[currentPage].length <= 1;
        document.getElementById('redoBtn').disabled = redoStack[currentPage].length === 0;
    }

    // Clear canvas
    document.getElementById('clearCanvas').addEventListener('click', () => {
        if (confirm('Are you sure you want to clear the current page?')) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            saveState();
        }
    });

    // Event listeners
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    window.addEventListener('resize', resizeCanvas);

    // Background style handling
    document.getElementById('backgroundStyle').addEventListener('change', (e) => {
        const workspace = document.querySelector('.workspace');
        workspace.className = 'workspace ' + e.target.value;
        // Force canvas redraw to show background
        redraw();
    });

    // Initialize
    function initialize() {
        resizeCanvas();
        createTextLayer();
        saveState();
        updatePageThumbnails();
        updateUndoRedoButtons();
    }

    initialize();

    // Add shape drawing function
    function drawShape(e) {
        if (originalCanvasState) {
            ctx.putImageData(originalCanvasState, 0, 0);
        }

        ctx.strokeStyle = currentColor;
        ctx.lineWidth = brushSize.value;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // Calculate dimensions
        const width = e.offsetX - startX;
        const height = e.offsetY - startY;

        if (currentLineStyle === 'double') {
            const gap = brushSize.value;
            
            switch(currentShape) {
                case 'line':
                    drawDoubleLine(startX, startY, e.offsetX, e.offsetY);
                    break;
                
                case 'rectangle':
                    const x = width > 0 ? startX : e.offsetX;
                    const y = height > 0 ? startY : e.offsetY;
                    const w = Math.abs(width);
                    const h = Math.abs(height);
                    
                    // Draw outer rectangle
                    ctx.strokeRect(x - gap/2, y - gap/2, w + gap, h + gap);
                    // Draw inner rectangle
                    ctx.strokeRect(x + gap/2, y + gap/2, w - gap, h - gap);
                    break;
                
                case 'circle':
                    const radius = Math.sqrt(width * width + height * height);
                    ctx.beginPath();
                    ctx.arc(startX, startY, radius + gap/2, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(startX, startY, radius - gap/2, 0, Math.PI * 2);
                    ctx.stroke();
                    break;
                
                case 'triangle':
                    // Outer triangle
                    ctx.beginPath();
                    ctx.moveTo(startX, startY - gap/2);
                    ctx.lineTo(startX + width + gap/2, e.offsetY + gap/2);
                    ctx.lineTo(startX - width - gap/2, e.offsetY + gap/2);
                    ctx.closePath();
                    ctx.stroke();
                    
                    // Inner triangle
                    ctx.beginPath();
                    ctx.moveTo(startX, startY + gap/2);
                    ctx.lineTo(startX + width - gap/2, e.offsetY - gap/2);
                    ctx.lineTo(startX - width + gap/2, e.offsetY - gap/2);
                    ctx.closePath();
                    ctx.stroke();
                    break;
            }
        } else {
            // Original shape drawing code for non-double lines
            if (currentLineStyle !== 'solid') {
                ctx.setLineDash(getLineDashPattern());
            } else {
                ctx.setLineDash([]);
            }

            ctx.beginPath();
            switch(currentShape) {
                case 'line':
                    ctx.moveTo(startX, startY);
                    ctx.lineTo(e.offsetX, e.offsetY);
                    break;
                
                case 'rectangle':
                    ctx.rect(
                        width > 0 ? startX : e.offsetX,
                        height > 0 ? startY : e.offsetY,
                        Math.abs(width),
                        Math.abs(height)
                    );
                    break;
                
                case 'circle':
                    const radius = Math.sqrt(width * width + height * height);
                    ctx.arc(startX, startY, radius, 0, Math.PI * 2);
                    break;
                
                case 'triangle':
                    ctx.moveTo(startX, startY);
                    ctx.lineTo(startX + width, e.offsetY);
                    ctx.lineTo(startX - width, e.offsetY);
                    ctx.closePath();
                    break;
            }
            ctx.stroke();
        }
    }

    // Add mouseup handler for shapes
    canvas.addEventListener('mouseup', () => {
        if (currentTool === 'shape' && isDrawing) {
            saveState();
            originalCanvasState = null;
        }
        isDrawing = false;
    });

    // Add mouseout handler for shapes
    canvas.addEventListener('mouseout', () => {
        if (currentTool === 'shape' && isDrawing) {
            saveState();
            originalCanvasState = null;
        }
        isDrawing = false;
    });

    // Add helper function for line dash patterns
    function getLineDashPattern() {
        const size = brushSize.value;
        switch(currentLineStyle) {
            case 'dashed':
                return [size * 3, size * 2];
            case 'dotted':
                // Make dots round and much more spaced
                ctx.lineCap = 'round';
                return [1, size * 8]; // Increased spacing multiplier from 4 to 8
            default:
                return [];
        }
    }

    // Add this function after getLineDashPattern()
    function drawDoubleLine(x1, y1, x2, y2) {
        const gap = brushSize.value;
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const perpendicular = angle + Math.PI/2;
        
        // Draw first line
        ctx.beginPath();
        ctx.moveTo(x1 + Math.cos(perpendicular) * gap, y1 + Math.sin(perpendicular) * gap);
        ctx.lineTo(x2 + Math.cos(perpendicular) * gap, y2 + Math.sin(perpendicular) * gap);
        ctx.stroke();
        
        // Draw second line
        ctx.beginPath();
        ctx.moveTo(x1 - Math.cos(perpendicular) * gap, y1 - Math.sin(perpendicular) * gap);
        ctx.lineTo(x2 - Math.cos(perpendicular) * gap, y2 - Math.sin(perpendicular) * gap);
        ctx.stroke();
    }

    // Add this after other event listeners
    document.getElementById('collapseSidebar').addEventListener('click', () => {
        const sidebar = document.querySelector('.page-sidebar');
        sidebar.classList.toggle('collapsed');
    });

    // Update text tool click handler
    document.getElementById('textTool').addEventListener('click', () => {
        currentTool = 'text';
        const textLayer = document.querySelector('.text-layer');
        textLayer.classList.add('text-active');
        document.getElementById('textOverlay').classList.add('show');
        document.getElementById('textInput').focus();
        Object.values(tools).forEach(tool => tool.classList.remove('active'));
        tools.text.classList.add('active');
    });

    // Text styling variables
    let isBold = false;
    let isItalic = false;
    let isUnderline = false;
    let textColor = '#000000';

    // Text style handlers
    document.getElementById('boldText').addEventListener('click', () => {
        isBold = !isBold;
        document.getElementById('boldText').classList.toggle('active');
        document.getElementById('textInput').style.fontWeight = isBold ? 'bold' : 'normal';
    });

    document.getElementById('italicText').addEventListener('click', () => {
        isItalic = !isItalic;
        document.getElementById('italicText').classList.toggle('active');
        document.getElementById('textInput').style.fontStyle = isItalic ? 'italic' : 'normal';
    });

    document.getElementById('underlineText').addEventListener('click', () => {
        isUnderline = !isUnderline;
        document.getElementById('underlineText').classList.toggle('active');
        document.getElementById('textInput').style.textDecoration = isUnderline ? 'underline' : 'none';
    });

    document.getElementById('textColor').addEventListener('input', (e) => {
        textColor = e.target.value;
        document.getElementById('textInput').style.color = textColor;
    });

    document.getElementById('fontFamily').addEventListener('change', (e) => {
        document.getElementById('textInput').style.fontFamily = e.target.value;
    });

    document.getElementById('fontSize').addEventListener('change', (e) => {
        document.getElementById('textInput').style.fontSize = `${e.target.value}px`;
    });

    // Add text handlers
    function addTextToPage(textElement) {
        if (!textElements[currentPage]) {
            textElements[currentPage] = [];
        }
        textElements[currentPage].push(textElement);
        document.querySelector('.text-layer').appendChild(textElement);
    }

    function clearPageTexts() {
        if (textElements[currentPage]) {
            textElements[currentPage].forEach(element => element.remove());
        }
    }

    function showPageTexts() {
        clearAllTexts();
        if (textElements[currentPage]) {
            const textLayer = document.querySelector('.text-layer');
            textElements[currentPage].forEach(element => {
                textLayer.appendChild(element);
            });
        }
    }

    function clearAllTexts() {
        document.querySelectorAll('.draggable-text').forEach(element => element.remove());
    }

    document.getElementById('applyText').addEventListener('click', () => {
        const text = document.getElementById('textInput').value;
        if (text.trim()) {
            if (currentEditingText) {
                // Update existing text
                currentEditingText.innerHTML = text;
                currentEditingText.style.fontFamily = document.getElementById('fontFamily').value;
                currentEditingText.style.fontSize = `${document.getElementById('fontSize').value}px`;
                currentEditingText.style.fontWeight = isBold ? 'bold' : 'normal';
                currentEditingText.style.fontStyle = isItalic ? 'italic' : 'normal';
                currentEditingText.style.textDecoration = isUnderline ? 'underline' : 'none';
                currentEditingText.style.color = textColor;
                
                // Re-add the buttons since we replaced innerHTML
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'text-delete-btn';
                deleteBtn.innerHTML = '×';
                deleteBtn.style.display = 'none';
                currentEditingText.appendChild(deleteBtn);

                const resizeHandle = document.createElement('div');
                resizeHandle.className = 'text-resize-handle';
                resizeHandle.style.display = 'none';
                currentEditingText.appendChild(resizeHandle);
                
                makeTextDraggable(currentEditingText);
                makeTextResizable(currentEditingText);
                currentEditingText = null;
            } else {
                // Create new text element
                const textElement = document.createElement('div');
                textElement.className = 'draggable-text';
                textElement.innerHTML = text;
                textElement.style.fontFamily = document.getElementById('fontFamily').value;
                textElement.style.fontSize = `${document.getElementById('fontSize').value}px`;
                textElement.style.fontWeight = isBold ? 'bold' : 'normal';
                textElement.style.fontStyle = isItalic ? 'italic' : 'normal';
                textElement.style.textDecoration = isUnderline ? 'underline' : 'none';
                textElement.style.color = textColor;
                
                // Add delete button
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'text-delete-btn';
                deleteBtn.innerHTML = '×';
                deleteBtn.style.display = 'none';
                textElement.appendChild(deleteBtn);

                // Add resize handle
                const resizeHandle = document.createElement('div');
                resizeHandle.className = 'text-resize-handle';
                resizeHandle.style.display = 'none';
                textElement.appendChild(resizeHandle);
                
                // Position in center
                const canvasContainer = document.querySelector('.canvas-container');
                const scrollTop = canvasContainer.scrollTop;
                const scrollLeft = canvasContainer.scrollLeft;
                const visibleWidth = canvasContainer.clientWidth;
                const visibleHeight = canvasContainer.clientHeight;
                
                textElement.style.left = `${scrollLeft + visibleWidth/2}px`;
                textElement.style.top = `${scrollTop + visibleHeight/2}px`;
                
                canvasContainer.appendChild(textElement);
                makeTextDraggable(textElement);
                makeTextResizable(textElement);
                addTextToPage(textElement);
            }
            resetTextEditor();
        }
    });

    document.getElementById('cancelText').addEventListener('click', resetTextEditor);

    function resetTextEditor() {
        document.getElementById('textInput').value = '';
        document.getElementById('textOverlay').classList.remove('show');
        isBold = isItalic = isUnderline = false;
        document.getElementById('boldText').classList.remove('active');
        document.getElementById('italicText').classList.remove('active');
        document.getElementById('underlineText').classList.remove('active');
        document.getElementById('textColor').value = '#000000';
        document.getElementById('fontFamily').value = 'Arial';
        document.getElementById('fontSize').value = '16';
        document.getElementById('textInput').style = '';
        currentEditingText = null;
    }

    function makeTextDraggable(element) {
        const deleteBtn = element.querySelector('.text-delete-btn');
        const resizeHandle = element.querySelector('.text-resize-handle');

        element.addEventListener('mousedown', (e) => {
            if (currentTool === 'text') {
                // Deselect all other text elements
                document.querySelectorAll('.draggable-text').forEach(el => {
                    if (el !== element) {
                        el.classList.remove('selected');
                        el.querySelector('.text-delete-btn').style.display = 'none';
                        el.querySelector('.text-resize-handle').style.display = 'none';
                    }
                });
                
                // Select this element
                element.classList.add('selected');
                deleteBtn.style.display = 'block';
                resizeHandle.style.display = 'block';

                if (e.target !== deleteBtn && e.target !== resizeHandle) {
                    isDraggingText = true;
                    currentDraggedText = element;
                    textOffset = {
                        x: e.clientX - element.offsetLeft,
                        y: e.clientY - element.offsetTop
                    };
                }
                e.stopPropagation();
            }
        });

        // Add double click to edit
        element.addEventListener('dblclick', (e) => {
            if (currentTool === 'text') {
                const textContent = element.innerText;
                document.getElementById('textInput').value = textContent;
                document.getElementById('textOverlay').classList.add('show');
                currentEditingText = element;
                e.stopPropagation();
            }
        });

        deleteBtn.addEventListener('click', (e) => {
            if (currentTool === 'text') {
                element.remove();
                textElements[currentPage] = textElements[currentPage].filter(el => el !== element);
                e.stopPropagation();
            }
        });
    }

    document.addEventListener('mousemove', (e) => {
        if (isDraggingText && currentDraggedText) {
            currentDraggedText.style.left = `${e.clientX - textOffset.x}px`;
            currentDraggedText.style.top = `${e.clientY - textOffset.y}px`;
        }
    });

    document.addEventListener('mouseup', () => {
        isDraggingText = false;
        currentDraggedText = null;
    });

    // Add text resizing functionality
    function makeTextResizable(element) {
        const resizeHandle = element.querySelector('.text-resize-handle');
        let isResizing = false;
        let originalWidth;
        let originalHeight;
        let originalX;
        let originalY;
        let originalFontSize;

        resizeHandle.addEventListener('mousedown', (e) => {
            if (currentTool === 'text') {
                isResizing = true;
                originalWidth = element.offsetWidth;
                originalHeight = element.offsetHeight;
                originalX = e.clientX;
                originalY = e.clientY;
                originalFontSize = parseInt(window.getComputedStyle(element).fontSize);
                e.preventDefault();
                e.stopPropagation();
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (isResizing) {
                const deltaX = e.clientX - originalX;
                const deltaY = e.clientY - originalY;
                const scale = Math.max(1 + (deltaX + deltaY) / 200, 0.5);
                const newFontSize = Math.max(originalFontSize * scale, 8);
                element.style.fontSize = `${newFontSize}px`;
            }
        });

        document.addEventListener('mouseup', () => {
            isResizing = false;
        });
    }

    // Add text layer creation
    function createTextLayer() {
        const textLayer = document.createElement('div');
        textLayer.className = 'text-layer';
        document.querySelector('.canvas-container').appendChild(textLayer);
        return textLayer;
    }

    // Add fullscreen handling
    document.getElementById('fullscreenToggle').addEventListener('click', () => {
        const container = document.querySelector('.container');
        const workspace = document.querySelector('.workspace');
        const currentBackground = workspace.className.split(' ')[1] || '';
        
        container.classList.add('fullscreen');
        
        // Show controls in expanded state
        const controls = document.querySelector('.fullscreen-controls');
        controls.classList.remove('hidden');
        
        // Hide toggle button initially since toolbar is visible
        const toggleBtn = document.querySelector('.fullscreen-toggle-btn');
        toggleBtn.classList.add('hidden');
        
        // Maintain background style
        if (currentBackground) {
            workspace.className = `workspace ${currentBackground}`;
        }
        
        updateFullscreenPageIndicator();
        resizeCanvas();
    });

    document.getElementById('exitFullscreen').addEventListener('click', () => {
        zoomLevel = 1;
        updateZoom();
        const container = document.querySelector('.container');
        const canvasContainer = document.querySelector('.canvas-container');
        
        // Reset scroll position
        canvasContainer.scrollLeft = 0;
        canvasContainer.scrollTop = 0;
        
        // Exit fullscreen
        container.classList.remove('fullscreen');
        document.querySelector('.fullscreen-controls').classList.add('hidden');
        document.querySelector('.fullscreen-toggle-btn').classList.add('hidden');
        
        // Resize and redraw
        resizeCanvas();
    });

    // Minimal controls handlers
    document.getElementById('minimalPen').addEventListener('click', () => {
        currentTool = 'pen';
        document.querySelectorAll('.minimal-tools button').forEach(btn => btn.classList.remove('active'));
        document.getElementById('minimalPen').classList.add('active');
    });

    document.getElementById('minimalHighlighter').addEventListener('click', () => {
        currentTool = 'highlighter';
        document.querySelectorAll('.minimal-tools button').forEach(btn => btn.classList.remove('active'));
        document.getElementById('minimalHighlighter').classList.add('active');
    });

    document.getElementById('minimalEraser').addEventListener('click', () => {
        currentTool = 'eraser';
        document.querySelectorAll('.minimal-tools button').forEach(btn => btn.classList.remove('active'));
        document.getElementById('minimalEraser').classList.add('active');
    });

    document.getElementById('minimalAddPage').addEventListener('click', () => {
        // Use existing addPage functionality
        document.getElementById('sidebarAddPage').click();
    });

    // Add delete page functionality
    function deletePage() {
        if (pages.length > 1) {
            if (confirm('Are you sure you want to delete this page?')) {
                pages.splice(currentPage, 1);
                undoStack.splice(currentPage, 1);
                redoStack.splice(currentPage, 1);
                delete textElements[currentPage];
                
                if (currentPage >= pages.length) {
                    currentPage = pages.length - 1;
                }
                
                updatePageThumbnails();
                redraw();
                updateFullscreenPageIndicator();
            }
        } else {
            alert('Cannot delete the last page');
        }
    }

    // Update delete page functionality
    document.getElementById('sidebarDeletePage').addEventListener('click', deletePage);
    document.getElementById('deletePageFullscreen').addEventListener('click', deletePage);

    // Update page indicator in fullscreen
    function updateFullscreenPageIndicator() {
        const indicator = document.getElementById('pageIndicatorFullscreen');
        if (indicator) {
            indicator.textContent = `Page ${currentPage + 1}/${pages.length}`;
        }
        
        // Update navigation buttons state
        const prevBtn = document.getElementById('prevPageFullscreen');
        const nextBtn = document.getElementById('nextPageFullscreen');
        if (prevBtn && nextBtn) {
            prevBtn.disabled = currentPage === 0;
            nextBtn.disabled = currentPage === pages.length - 1;
        }
    }

    // Add page navigation handlers for fullscreen
    document.getElementById('prevPageFullscreen').addEventListener('click', () => {
        if (currentPage > 0) {
            currentPage--;
            updatePageThumbnails();
            redraw();
            updateFullscreenPageIndicator();
        }
    });

    document.getElementById('nextPageFullscreen').addEventListener('click', () => {
        if (currentPage < pages.length - 1) {
            currentPage++;
            updatePageThumbnails();
            redraw();
            updateFullscreenPageIndicator();
        }
    });

    // Update zoom functionality
    function updateZoom() {
        const canvas = document.getElementById('drawingCanvas');
        const textLayer = document.querySelector('.text-layer');
        const container = document.querySelector('.canvas-container');
        
        // Update zoom display
        document.getElementById('zoomLevel').textContent = `${Math.round(zoomLevel * 100)}%`;
        
        // Calculate center point before zoom
        const centerX = (container.scrollLeft + container.clientWidth / 2) / zoomLevel;
        const centerY = (container.scrollTop + container.clientHeight / 2) / zoomLevel;
        
        // Apply zoom
        canvas.style.transform = `scale(${zoomLevel})`;
        textLayer.style.transform = `scale(${zoomLevel})`;
        
        // Set transform origin to center
        canvas.style.transformOrigin = '0 0';
        textLayer.style.transformOrigin = '0 0';
        
        // Adjust scroll position to maintain center point
        requestAnimationFrame(() => {
            container.scrollLeft = centerX * zoomLevel - container.clientWidth / 2;
            container.scrollTop = centerY * zoomLevel - container.clientHeight / 2;
        });
    }

    // Update fullscreen controls
    document.querySelector('.fullscreen-toggle-btn').addEventListener('click', () => {
        const controls = document.querySelector('.fullscreen-controls');
        const collapseBtn = document.getElementById('collapseToolbar');
        const toggleBtn = document.querySelector('.fullscreen-toggle-btn');
        
        controls.classList.remove('collapsed');
        collapseBtn.classList.remove('collapsed');
        toggleBtn.classList.add('hidden');
        controls.classList.remove('hidden');
    });

    // Add save/load functionality
    async function saveDrawing() {
        try {
            // Use native file save dialog without prompt
            const handle = await window.showSaveFilePicker({
                suggestedName: 'drawing.bkl',
                types: [{
                    description: 'Blackboard File',
                    accept: {
                        'application/x-bkl': ['.bkl'],
                    },
                }],
            });

            const drawingData = {
                pages: pages.map((_, index) => ({
                    imageData: undoStack[index][undoStack[index].length - 1],
                    texts: textElements[index] ? textElements[index].map(text => ({
                        content: text.innerText,
                        style: {
                            left: text.style.left,
                            top: text.style.top,
                            fontFamily: text.style.fontFamily,
                            fontSize: text.style.fontSize,
                            fontWeight: text.style.fontWeight,
                            fontStyle: text.style.fontStyle,
                            textDecoration: text.style.textDecoration,
                            color: text.style.color
                        }
                    })) : [],
                    isPdfPage: false // Add flag to identify PDF pages
                })),
                currentPage: currentPage,
                backgroundStyle: document.querySelector('.workspace').className.split(' ')[1] || 'plain'
            };

            const writable = await handle.createWritable();
            await writable.write(JSON.stringify(drawingData));
            await writable.close();
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('Failed to save file:', err);
                // Fallback to old method if native dialog is not supported
                const blob = new Blob([JSON.stringify(drawingData)], { type: 'application/x-bkl' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'drawing.bkl';
                a.click();
                URL.revokeObjectURL(url);
            }
        }
    }

    function loadDrawing(file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const drawingData = JSON.parse(e.target.result);
            
            // Clear current state
            pages = [];
            undoStack = [];
            redoStack = [];
            textElements = {};
            
            // Load pages and their content
            drawingData.pages.forEach((pageData, index) => {
                pages[index] = [];
                undoStack[index] = [pageData.imageData];
                redoStack[index] = [];
                textElements[index] = [];
                
                // Load texts
                pageData.texts.forEach(textData => {
                    const textElement = document.createElement('div');
                    textElement.className = 'draggable-text';
                    textElement.innerText = textData.content;
                    Object.assign(textElement.style, textData.style);
                    
                    // Add delete button and resize handle
                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'text-delete-btn';
                    deleteBtn.innerHTML = '×';
                    deleteBtn.style.display = 'none';
                    textElement.appendChild(deleteBtn);

                    const resizeHandle = document.createElement('div');
                    resizeHandle.className = 'text-resize-handle';
                    resizeHandle.style.display = 'none';
                    textElement.appendChild(resizeHandle);
                    
                    makeTextDraggable(textElement);
                    makeTextResizable(textElement);
                    textElements[index].push(textElement);
                });
            });
            
            // Set current page and background
            currentPage = drawingData.currentPage;
            const workspace = document.querySelector('.workspace');
            workspace.className = `workspace ${drawingData.backgroundStyle}`;
            
            // Update UI
            updatePageThumbnails();
            redraw();
        };
        reader.readAsText(file);
    }

    // Add event listeners
    document.getElementById('saveFile').addEventListener('click', saveDrawing);

    document.getElementById('loadFile').addEventListener('click', () => {
        document.getElementById('fileInput').click();
    });

    document.getElementById('fileInput').addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            loadDrawing(e.target.files[0]);
            e.target.value = ''; // Reset file input
        }
    });

    // Add to fullscreen controls
    const fullscreenFileActions = `
        <div class="file-actions-fullscreen">
            <button id="saveFileFullscreen" title="Save File"><i class="fas fa-save"></i></button>
            <button id="loadFileFullscreen" title="Load File"><i class="fas fa-folder-open"></i></button>
        </div>
    `;

    document.querySelector('.minimal-tools').insertAdjacentHTML('beforeend', fullscreenFileActions);

    // Add fullscreen save/load handlers
    document.getElementById('saveFileFullscreen').addEventListener('click', saveDrawing);
    document.getElementById('loadFileFullscreen').addEventListener('click', () => {
        document.getElementById('fileInput').click();
    });

    // Update importPDF function
    async function importPDF() {
        const input = document.getElementById('pdfFileInput');
        if (!input.files || !input.files[0]) return;

        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'loading-overlay';
        loadingDiv.innerHTML = `
            <div class="loading-content">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Loading PDF...</p>
            </div>
        `;
        document.body.appendChild(loadingDiv);

        try {
            const file = input.files[0];
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;

            // Store the current page index for insertion
            const insertIndex = currentPage + 1;

            // Convert each PDF page to a new page in our app
            for (let i = 1; i <= pdf.numPages; i++) {
                loadingDiv.querySelector('p').textContent = `Importing page ${i} of ${pdf.numPages}`;
                
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: 2 }); // Increased scale for better quality
                
                // Create temporary canvas for PDF rendering
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = viewport.width; // Set width to PDF width
                tempCanvas.height = viewport.height; // Set height to PDF height
                const tempCtx = tempCanvas.getContext('2d');

                // Fill white background
                tempCtx.fillStyle = 'white';
                tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

                // Render PDF page with high quality settings
                await page.render({
                    canvasContext: tempCtx,
                    viewport: viewport,
                    background: 'white'
                }).promise;

                // Insert new page after current page
                pages.splice(insertIndex + i - 1, 0, []);
                undoStack.splice(insertIndex + i - 1, 0, [tempCanvas.toDataURL('image/jpeg', 1.0)]);
                redoStack.splice(insertIndex + i - 1, 0, []);
                textElements[insertIndex + i - 1] = [];
            }

            // Move to the first imported page
            currentPage = insertIndex;

            // Update UI
            updatePageThumbnails();
            redraw();
            updateFullscreenPageIndicator();

            // Ensure the workspace scrolls to the bottom if needed
            const workspace = document.querySelector('.workspace');
            workspace.scrollTop = workspace.scrollHeight; // Scroll to the bottom

        } catch (error) {
            console.error('Error importing PDF:', error);
            alert('Error importing PDF. Please try again.');
        } finally {
            if (loadingDiv && loadingDiv.parentNode) {
                loadingDiv.parentNode.removeChild(loadingDiv);
            }
            input.value = '';
        }
    }

    // Update event listeners
    document.getElementById('importPDF').addEventListener('click', () => {
        document.getElementById('pdfFileInput').click();
    });

    document.getElementById('pdfFileInput').addEventListener('change', async (e) => {
        if (e.target.files.length > 0) {
            await importPDF();
        }
    });

    // Update exportToPDF function
    async function exportToPDF() {
        let loadingDiv = null;
        try {
            const filename = prompt('Enter a name for your PDF:', 'drawing.pdf');
            if (!filename) return;

            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'px',
                format: [1200, 1600], // Match the canvas size
                compress: true
            });

            loadingDiv = document.createElement('div');
            loadingDiv.className = 'loading-overlay';
            loadingDiv.innerHTML = `
                <div class="loading-content">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Generating PDF (0/${pages.length} pages)...</p>
                </div>
            `;
            document.body.appendChild(loadingDiv);

            const currentPageBackup = currentPage;
            const workspace = document.querySelector('.workspace');
            const backgroundStyle = workspace.className.split(' ')[1] || '';

            try {
                for (let i = 0; i < pages.length; i++) {
                    currentPage = i;
                    redraw();
                    await new Promise(resolve => setTimeout(resolve, 100)); // Wait for redraw
                    showPageTexts();
                    await new Promise(resolve => setTimeout(resolve, 100)); // Wait for texts

                    // Create a temporary canvas for capturing the entire content
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = 1200; // Match the canvas width
                    tempCanvas.height = 1600; // Match the canvas height
                    const tempCtx = tempCanvas.getContext('2d');

                    // Fill with white background
                    tempCtx.fillStyle = 'white';
                    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

                    // Draw background pattern if exists
                    if (backgroundStyle) {
                        if (backgroundStyle === 'grid') {
                            drawGrid(tempCtx);
                        } else if (backgroundStyle === 'lined') {
                            drawLines(tempCtx);
                        } else if (backgroundStyle === 'dotted') {
                            drawDots(tempCtx);
                        }
                    }

                    // Draw the main canvas content
                    const mainCanvas = document.getElementById('drawingCanvas');
                    tempCtx.drawImage(mainCanvas, 0, 0);

                    // Capture text elements
                    const textLayer = document.querySelector('.text-layer');
                    await html2canvas(textLayer, {
                        canvas: tempCanvas,
                        backgroundColor: null,
                        scale: 2 // Increase quality
                    });

                    if (i > 0) pdf.addPage();
                    pdf.addImage(tempCanvas.toDataURL('image/jpeg', 1.0), 'JPEG', 0, 0, 1200, 1600); // Match dimensions

                    loadingDiv.querySelector('p').textContent = 
                        `Generating PDF (${i + 1}/${pages.length} pages)...`;
                }

                pdf.save(filename);
            } finally {
                currentPage = currentPageBackup;
                redraw();
                showPageTexts();
                if (loadingDiv) loadingDiv.remove();
            }
        } catch (err) {
            console.error('Failed to generate PDF:', err);
            alert('Error generating PDF. Please try again.');
            if (loadingDiv) loadingDiv.remove();
        }
    }

    // Add helper functions for background patterns
    function drawGrid(ctx) {
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 1;

        // Draw vertical lines
        for (let x = 0; x <= 1200; x += 20) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, 1600);
            ctx.stroke();
        }

        // Draw horizontal lines
        for (let y = 0; y <= 1600; y += 20) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(1200, y);
            ctx.stroke();
        }
    }

    function drawLines(ctx) {
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 1;

        for (let y = 0; y <= 1600; y += 20) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(1200, y);
            ctx.stroke();
        }
    }

    function drawDots(ctx) {
        ctx.fillStyle = '#ddd';
        for (let x = 0; x <= 1200; x += 20) {
            for (let y = 0; y <= 1600; y += 20) {
                ctx.beginPath();
                ctx.arc(x, y, 1, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    // Add event listeners for PDF export
    document.getElementById('exportPDF').addEventListener('click', exportToPDF);

    // Add zoom functionality
    document.getElementById('zoomIn').addEventListener('click', () => {
        if (zoomLevel < MAX_ZOOM) {
            zoomLevel = Math.min(zoomLevel + ZOOM_STEP, MAX_ZOOM);
            updateZoom();
        }
    });

    document.getElementById('zoomOut').addEventListener('click', () => {
        if (zoomLevel > MIN_ZOOM) {
            zoomLevel = Math.max(zoomLevel - ZOOM_STEP, MIN_ZOOM);
            updateZoom();
        }
    });

    // Add wheel zoom support
    document.querySelector('.canvas-container').addEventListener('wheel', (e) => {
        if (e.ctrlKey) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
            zoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomLevel + delta));
            updateZoom();
        }
    });

    // Add collapse toolbar functionality
    document.getElementById('collapseToolbar').addEventListener('click', () => {
        const controls = document.querySelector('.fullscreen-controls');
        const collapseBtn = document.getElementById('collapseToolbar');
        const toggleBtn = document.querySelector('.fullscreen-toggle-btn');
        
        if (controls.classList.contains('collapsed')) {
            // Expanding
            controls.classList.remove('collapsed');
            collapseBtn.classList.remove('collapsed');
            toggleBtn.classList.add('hidden');
        } else {
            // Collapsing
            controls.classList.add('collapsed');
            collapseBtn.classList.add('collapsed');
            toggleBtn.classList.remove('hidden');
        }
    });

    // Function to handle text selection
    function selectText(textElement) {
        // Show the delete button and resize handle
        const deleteBtn = textElement.querySelector('.text-delete-btn');
        const resizeHandle = textElement.querySelector('.text-resize-handle');

        deleteBtn.style.display = 'block'; // Show delete button
        resizeHandle.style.display = 'block'; // Show resize handle

        // Add event listeners for dragging and deleting
        deleteBtn.addEventListener('click', () => {
            textElement.remove(); // Remove the text element
        });

        // Add logic for resizing if needed
        resizeHandle.addEventListener('mousedown', (e) => {
            // Logic for resizing the text element
        });
    }

    // Function to deselect text
    function deselectText() {
        const textElements = document.querySelectorAll('.draggable-text');
        textElements.forEach(textElement => {
            const deleteBtn = textElement.querySelector('.text-delete-btn');
            const resizeHandle = textElement.querySelector('.text-resize-handle');

            deleteBtn.style.display = 'none'; // Hide delete button
            resizeHandle.style.display = 'none'; // Hide resize handle
        });
    }

    // Example of how to call deselectText when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.classList.contains('draggable-text')) {
            deselectText(); // Deselect if clicking outside
        }
    });

    // Add stylus support
    function setupStylusSupport(canvas) {
        // Prevent default touch actions like scrolling
        canvas.style.touchAction = 'none';
    
        canvas.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'pen') {
                e.preventDefault();
                startDrawing(e);
            }
        });
    
        canvas.addEventListener('pointermove', (e) => {
            if (e.pointerType === 'pen' && isDrawing) {
                e.preventDefault();
                draw(e);
            }
        });
    
        canvas.addEventListener('pointerup', (e) => {
            if (e.pointerType === 'pen') {
                e.preventDefault();
                stopDrawing();
            }
        });
    
        canvas.addEventListener('pointerleave', (e) => {
            if (e.pointerType === 'pen') {
                stopDrawing();
            }
        });
    }
    
    // Call this function to set up stylus support
    setupStylusSupport(document.getElementById('drawingCanvas'));
    
}); 