import './styles/base.css';
import './styles/sections.css';
import './styles/memories.css';

import { fetchMemories, renderMemoryCard, setupLightbox } from './modules/memoriesGallery.js';
import { uploadMemory } from './modules/upload.js';
import { isAuthenticated, showPasscodeModal } from './modules/auth.js';

let selectedFiles = [];

document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('memoriesGrid');
  const emptyMsg = document.getElementById('memoriesEmpty');
  const uploadToggle = document.getElementById('uploadToggle');
  const uploadPanel = document.getElementById('uploadPanel');
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const previewList = document.getElementById('previewList');
  const uploadProgress = document.getElementById('uploadProgress');
  const progressBar = document.getElementById('progressBar');
  const uploadStatus = document.getElementById('uploadStatus');
  const uploadSubmit = document.getElementById('uploadSubmit');
  const uploadCancel = document.getElementById('uploadCancel');

  setupLightbox(grid);
  loadGallery();

  async function loadGallery() {
    grid.innerHTML = '';
    const memories = await fetchMemories(100);
    if (memories.length === 0) {
      emptyMsg.style.display = 'block';
      return;
    }
    emptyMsg.style.display = 'none';
    memories.forEach((m, i) => {
      const card = renderMemoryCard(m);
      card.setAttribute('data-delay', String((i % 4) + 1));
      grid.appendChild(card);
    });
    setupReveal();
  }

  function setupReveal() {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach(e => {
        if (e.isIntersecting) e.target.classList.add('visible');
      }),
      { threshold: 0.1 }
    );
    grid.querySelectorAll('.reveal').forEach(el => observer.observe(el));
  }

  // Upload toggle
  uploadToggle.addEventListener('click', async () => {
    if (!isAuthenticated()) {
      const hash = await showPasscodeModal();
      if (!hash) return;
    }
    uploadPanel.classList.toggle('active');
    if (!uploadPanel.classList.contains('active')) resetUpload();
  });

  // File selection
  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

  // Drag & drop
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
  });

  function handleFiles(fileList) {
    const newFiles = Array.from(fileList).filter(f => f.type.startsWith('image/'));
    selectedFiles.push(...newFiles);
    renderPreviews();
    uploadSubmit.disabled = selectedFiles.length === 0;
  }

  function renderPreviews() {
    previewList.innerHTML = '';
    selectedFiles.forEach((file, idx) => {
      const item = document.createElement('div');
      item.className = 'upload-preview-item';
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      const captionInput = document.createElement('input');
      captionInput.type = 'text';
      captionInput.placeholder = 'Caption...';
      captionInput.dataset.idx = idx;
      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-preview';
      removeBtn.textContent = '\u00D7';
      removeBtn.addEventListener('click', () => {
        selectedFiles.splice(idx, 1);
        renderPreviews();
        uploadSubmit.disabled = selectedFiles.length === 0;
      });
      item.appendChild(img);
      item.appendChild(removeBtn);
      item.appendChild(captionInput);
      previewList.appendChild(item);
    });
  }

  // Upload
  uploadSubmit.addEventListener('click', async () => {
    if (selectedFiles.length === 0) return;
    uploadSubmit.disabled = true;
    uploadProgress.classList.add('active');

    const captions = Array.from(previewList.querySelectorAll('input'))
      .map(inp => inp.value.trim());

    let uploaded = 0;
    const total = selectedFiles.length;

    for (let i = 0; i < total; i++) {
      uploadStatus.textContent = `Uploading ${i + 1} of ${total}...`;
      try {
        await uploadMemory(selectedFiles[i], captions[i] || '', (progress) => {
          const overall = ((uploaded + progress / 100) / total) * 100;
          progressBar.style.width = overall + '%';
        });
        uploaded++;
      } catch (err) {
        console.error('Upload failed:', err);
        uploadStatus.textContent = `Failed to upload image ${i + 1}. Try again.`;
        uploadSubmit.disabled = false;
        return;
      }
    }

    uploadStatus.textContent = `${uploaded} ${uploaded === 1 ? 'memory' : 'memories'} uploaded!`;
    progressBar.style.width = '100%';
    setTimeout(() => {
      resetUpload();
      uploadPanel.classList.remove('active');
      loadGallery();
    }, 1500);
  });

  uploadCancel.addEventListener('click', () => {
    resetUpload();
    uploadPanel.classList.remove('active');
  });

  function resetUpload() {
    selectedFiles = [];
    previewList.innerHTML = '';
    fileInput.value = '';
    progressBar.style.width = '0%';
    uploadProgress.classList.remove('active');
    uploadStatus.textContent = '';
    uploadSubmit.disabled = true;
  }
});
