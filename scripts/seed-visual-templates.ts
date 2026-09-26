import { join } from 'path';
import { mkdir, writeFile } from 'fs/promises';

const workspaceTemplatesDir = join(process.cwd(), 'workspace', 'templates');

interface LayoutElement {
  id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  content: string;
  color?: string;
  fontSize?: number;
}

interface CanvasSettings {
  bgColor: string;
  bgImage: string;
}

async function createVisualTemplate(id: string, name: string, type: string, canvas: CanvasSettings, elements: LayoutElement[]) {
  const dir = join(workspaceTemplatesDir, id);
  await mkdir(dir, { recursive: true });

  let html = '<div class="template-canvas">\n';
  let css = `.template-canvas { position: relative; width: 100%; height: 100%; overflow: hidden; background-color: ${canvas.bgColor}; ${canvas.bgImage ? `background-image: url('${canvas.bgImage}'); background-size: cover; background-position: center;` : ''} }\n`;

  elements.forEach(el => {
    if (el.type === 'text') {
      html += `  <div id="el-${el.id}" class="visual-el">${el.content}</div>\n`;
    } else if (el.type === 'image') {
      html += `  <img id="el-${el.id}" class="visual-el" src="${el.content}" alt="" />\n`;
    } else if (el.type === 'account-logo') {
      html += `  <img id="el-${el.id}" class="visual-el" src="{{account.logo}}" alt="Account Logo" />\n`;
    }

    css += `#el-${el.id} {
  position: absolute;
  left: ${el.x}px;
  top: ${el.y}px;
  width: ${el.w}px;
  height: ${el.h}px;
  color: ${el.color || '#ffffff'};
  font-size: ${el.fontSize || 24}px;
  display: flex;
  align-items: center;
  justify-content: center;
}\n`;
  });
  html += '</div>';

  const jsonConfig = {
    id,
    name,
    type,
    input: { type: type === 'video-overlay' ? 'video' : 'html' },
    output: { width: 1080, height: 1920, fps: 30 },
    layoutElements: elements,
    canvasSettings: canvas
  };

  await writeFile(join(dir, 'index.html'), html);
  await writeFile(join(dir, 'style.css'), css);
  await writeFile(join(dir, 'template.json'), JSON.stringify(jsonConfig, null, 2));

  console.log(`Created reusable template: ${name} (${id})`);
}

async function run() {
  await mkdir(workspaceTemplatesDir, { recursive: true });

  // Template 1: Basic Overlay with Account Logo
  await createVisualTemplate(
    'branded-overlay',
    'Branded Account Overlay',
    'video-overlay',
    { bgColor: '#00000000', bgImage: '' },
    [
      { id: 'logo1', type: 'account-logo', x: 50, y: 50, w: 150, h: 150, content: '{{account.logo}}' },
      { id: 'text1', type: 'text', x: 50, y: 1700, w: 980, h: 100, content: '@{{account.name}} | Follow Us', color: '#ffffff', fontSize: 48 },
      { id: 'box1', type: 'image', x: 0, y: 1650, w: 1080, h: 270, content: 'https://placehold.co/1080x270/000000/000000?text=+' } // Dark gradient background substitute
    ]
  );

  // Template 2: Full Screen Promotion with Background
  await createVisualTemplate(
    'promo-fullscreen',
    'Full Screen Promo Bg',
    'html-template',
    { bgColor: '#1e1b4b', bgImage: 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=1080&h=1920&fit=crop' },
    [
      { id: 't1', type: 'text', x: 90, y: 300, w: 900, h: 200, content: 'SPECIAL PROMO', color: '#fcd34d', fontSize: 120 },
      { id: 't2', type: 'text', x: 90, y: 550, w: 900, h: 100, content: '{{account.description}}', color: '#ffffff', fontSize: 40 },
      { id: 'logo', type: 'account-logo', x: 340, y: 1200, w: 400, h: 400, content: '{{account.logo}}' }
    ]
  );
}

run().catch(console.error);
