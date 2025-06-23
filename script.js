const canvas = document.getElementById('canvas');
const connectionsSvg = document.getElementById('connections');
const addNodeBtn = document.getElementById('addNode');
const saveBtn = document.getElementById('saveWorkflow');
const loadBtn = document.getElementById('loadWorkflow');
const modal = document.getElementById('modal');
const nodeTitleInput = document.getElementById('nodeTitle');
const nodeContentInput = document.getElementById('nodeContent');
const saveNodeBtn = document.getElementById('saveNode');
const cancelNodeBtn = document.getElementById('cancelNode');

let nodes = [];
let edges = [];
let currentNode = null;
let scale = 1;
let origin = {x:0, y:0};

function createNode(data){
    const node = document.createElement('div');
    node.className = 'node';
    node.style.left = (data.x||0) + 'px';
    node.style.top = (data.y||0) + 'px';
    node.dataset.id = data.id;
    node.dataset.content = data.content || '';

    const title = document.createElement('div');
    title.className = 'node-title';
    title.textContent = data.title || 'Untitled';
    node.appendChild(title);

    const copyBtn = document.createElement('span');
    copyBtn.className = 'copy-btn';
    copyBtn.textContent = '📋';
    copyBtn.title = 'Sao chép';
    copyBtn.onclick = () => {
        navigator.clipboard.writeText(node.dataset.content || '').then(() => {
            copyBtn.textContent = '✅';
            setTimeout(() => copyBtn.textContent = '📋', 1000);
        });
    };
    node.appendChild(copyBtn);

    const handle = document.createElement('div');
    handle.className = 'connection-handle';
    node.appendChild(handle);

    let offset = {x:0,y:0};
    node.onpointerdown = e => {
        if(e.target === handle) return;
        offset.x = e.clientX - node.offsetLeft;
        offset.y = e.clientY - node.offsetTop;
        node.setPointerCapture(e.pointerId);
        node.onpointermove = ev => {
            node.style.left = (ev.clientX - offset.x) + 'px';
            node.style.top = (ev.clientY - offset.y) + 'px';
            updateConnections();
        };
        node.onpointerup = () => {
            node.onpointermove = null;
            node.onpointerup = null;
            saveState();
        };
    };

    node.ondblclick = () => {
        currentNode = node;
        nodeTitleInput.value = title.textContent;
        nodeContentInput.value = node.dataset.content;
        modal.classList.remove('hidden');
    };

    handle.onpointerdown = e => {
        e.stopPropagation();
        const start = getNodeCenter(node);
        const tempLine = createLine(start,start);
        connectionsSvg.appendChild(tempLine);
        document.onpointermove = ev => {
            const pt = toCanvasCoords(ev.clientX, ev.clientY);
            setLine(tempLine,start,pt);
        };
        document.onpointerup = ev => {
            document.onpointermove = null;
            document.onpointerup = null;
            connectionsSvg.removeChild(tempLine);
            const target = document.elementFromPoint(ev.clientX, ev.clientY);
            if(target && target.classList.contains('node') && target!==node){
                edges.push({from: node.dataset.id, to: target.dataset.id});
                drawConnections();
                saveState();
            }
        };
    };

    canvas.appendChild(node);
    nodes.push(node);
}

function createLine(a,b){
    const line = document.createElementNS('http://www.w3.org/2000/svg','line');
    line.setAttribute('stroke','#000');
    line.setAttribute('marker-end','url(#arrow)');
    setLine(line,a,b);
    return line;
}
function setLine(line,a,b){
    line.setAttribute('x1',a.x);
    line.setAttribute('y1',a.y);
    line.setAttribute('x2',b.x);
    line.setAttribute('y2',b.y);
}
function getNodeCenter(node){
    return {x: parseFloat(node.style.left)+node.offsetWidth/2,
            y: parseFloat(node.style.top)+node.offsetHeight/2};
}
function drawConnections(){
    connectionsSvg.innerHTML = '<defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L10,5 L0,10 z" fill="#000"/></marker></defs>';
    edges.forEach(edge=>{
        const from = nodes.find(n=>n.dataset.id===edge.from);
        const to = nodes.find(n=>n.dataset.id===edge.to);
        if(from && to){
            const line = createLine(getNodeCenter(from), getNodeCenter(to));
            connectionsSvg.appendChild(line);
        }
    });
}
function updateConnections(){ drawConnections(); }
function toCanvasCoords(x,y){
    const rect = canvas.getBoundingClientRect();
    return {x:(x-rect.left)/scale, y:(y-rect.top)/scale};
}
addNodeBtn.onclick = () => {
    const id = Date.now().toString();
    createNode({id, x:50, y:50, title:'Bước mới', content:''});
    saveState();
};
saveBtn.onclick = saveState;
loadBtn.onclick = loadState;
function saveState(){
    const data = {
        nodes: nodes.map(n=>({id:n.dataset.id, x:parseFloat(n.style.left), y:parseFloat(n.style.top), title:n.querySelector('.node-title').textContent, content:n.dataset.content})),
        edges
    };
    localStorage.setItem('promptflow', JSON.stringify(data));
}
function loadState(){
    const data = JSON.parse(localStorage.getItem('promptflow')||'null');
    if(!data) return;
    canvas.innerHTML='';
    nodes=[];
    edges=data.edges||[];
    data.nodes.forEach(n=>createNode(n));
    drawConnections();
}
saveNodeBtn.onclick = () => {
    if(currentNode){
        currentNode.querySelector('.node-title').textContent = nodeTitleInput.value;
        currentNode.dataset.content = nodeContentInput.value;
        saveState();
    }
    modal.classList.add('hidden');
};
cancelNodeBtn.onclick = () => { modal.classList.add('hidden'); };

const canvasContainer = document.getElementById('canvasContainer');
canvasContainer.onpointerdown = e => {
    if(e.target!==canvasContainer) return;
    const start = {x:e.clientX, y:e.clientY};
    const startOrigin = {...origin};
    canvasContainer.setPointerCapture(e.pointerId);
    canvasContainer.onpointermove = ev => {
        origin.x = startOrigin.x + (ev.clientX - start.x);
        origin.y = startOrigin.y + (ev.clientY - start.y);
        updateTransform();
    };
    canvasContainer.onpointerup = () => {
        canvasContainer.onpointermove = null;
        canvasContainer.onpointerup = null;
    };
};
canvasContainer.onwheel = e => {
    e.preventDefault();
    const delta = e.deltaY>0 ? 0.9 : 1.1;
    scale *= delta;
    updateTransform();
};
function updateTransform(){
    canvas.style.transform = `translate(${origin.x}px,${origin.y}px) scale(${scale})`;
    connectionsSvg.style.transform = canvas.style.transform;
    drawConnections();
window.onload = loadState;
