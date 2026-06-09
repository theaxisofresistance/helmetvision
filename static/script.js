/**
 * ============================================================
 * HELMET VISION AI — script.js (Final Production Polish)
 * Optimized for University Presentation, Memory Management & Configurable Logic
 * ============================================================
 */

document.addEventListener('DOMContentLoaded', () => {

  // ============================================================
  // GLOBAL PRESENTATION & CONFIGURATION SETTINGS
  // ============================================================
  const PRESENTATION_MODE = true;
  const APP_VERSION = "1.0.0";

  const PROJECT_CONFIG = {
    datasetHelmet: 2500,
    datasetNoHelmet: 2500,
    validationAccuracy: [72, 78, 81, 85, 87, 89, 91, 93, 93.8, 94.2]
  };

  const PROJECT_STATS = {
    total: 125,
    safe: 98,
    violation: 27
  };

  // Safe Console Wrapper based on Presentation Mode Execution
  const Logger = {
    log: (...args) => { if (!PRESENTATION_MODE) console.log(...args); },
    warn: (...args) => { if (!PRESENTATION_MODE) console.warn(...args); },
    error: (...args) => { console.error(...args); } // Errors are always captured
  };

  if (!PRESENTATION_MODE) {
    Logger.log(`HelmetVision AI Dashboard - Version ${APP_VERSION} Initialized.`);
  }

  // ============================================================
  // GLOBAL STATE MANAGEMENT
  // ============================================================
  let detectionInterval = null;
  let isDetectionRunning = false;
  let isDetectionPaused = false;
  let webcamStream = null;
  let currentActiveFileUrl = null;
  let logIdCounter = 3;

  // Chart Global Instances
  let accuracyChartInstance = null;
  let classChartInstance = null;

  // Configuration Standards
  const MAX_TOASTS = 5;
  const FALLBACK_PREVIEW = 'https://placehold.co/700x400/111111/333333?text=No+Feed+Active';

  // Active Monitoring Dashboard Core Counters derived from Config
  const statsState = { ...PROJECT_STATS };

  // Central Database In-Memory Cache Initial Data
  const initialLogsCache = [
    { no: 1, timestamp: '18:30:12', snapshot: 'https://placehold.co/48x32/1a1a1a/00e676?text=H', status: 'safe', confidence: '96%' },
    { no: 2, timestamp: '18:30:45', snapshot: 'https://placehold.co/48x32/1a1a1a/ff5252?text=NH', status: 'violation', confidence: '88%' },
    { no: 3, timestamp: '18:31:01', snapshot: 'https://placehold.co/48x32/1a1a1a/00e676?text=H', status: 'safe', confidence: '94%' }
  ];
  let logsData = [...initialLogsCache];
  logIdCounter = logsData.length;

  // DOM Element Reference Cache Mapping
  const DOM = {
    html: document.documentElement,
    themeToggle: document.getElementById('themeToggle'),
    themeIcon: document.getElementById('themeIcon'),
    hamburger: document.getElementById('hamburger'),
    navLinks: document.getElementById('navLinks'),
    navLinksA: document.querySelectorAll('.nav-link'),
    settingsModal: document.getElementById('settingsModal'),
    openSettings: document.getElementById('openSettings'),
    closeSettings: document.getElementById('closeSettings'),
    saveSettings: document.getElementById('saveSettings'),
    confThreshold: document.getElementById('confThreshold'),
    confThreshVal: document.getElementById('confThreshVal'),
    camSource: document.getElementById('camSource'),
    themeRadios: document.querySelectorAll('input[name="theme"]'),
    toastContainer: document.getElementById('toastContainer'),
    tabBtns: document.querySelectorAll('.tab-btn'),
    tabContents: document.querySelectorAll('.tab-content'),
    dropZone: document.getElementById('dropZone'),
    uploadImage: document.getElementById('uploadImage'),
    uploadVideo: document.getElementById('uploadVideo'),
    startWebcam: document.getElementById('startWebcam'),
    stopWebcam: document.getElementById('stopWebcam'),
    webcamFeed: document.getElementById('webcamFeed'),
    uploadedPreview: document.getElementById('uploadedPreview'),
    ipCamUrl: document.getElementById('ipCamUrl'),
    connectCam: document.getElementById('connectCam'),
    mainMonitor: document.getElementById('mainMonitor'),
    bbox1: document.getElementById('bbox1'),
    bbox2: document.getElementById('bbox2'),
    detectionStatus: document.getElementById('detectionStatus'),
    monitorTime: document.getElementById('monitorTime'),
    startDetection: document.getElementById('startDetection'),
    pauseDetection: document.getElementById('pauseDetection'),
    stopDetection: document.getElementById('stopDetection'),
    counters: document.querySelectorAll('.counter'),
    confValue: document.getElementById('confValue'),
    confBar: document.getElementById('confBar'),
    activityFeed: document.getElementById('activityFeed'),
    logsSearch: document.getElementById('logsSearch'),
    logsFilter: document.getElementById('logsFilter'),
    exportCSV: document.getElementById('exportCSV'),
    exportExcel: document.getElementById('exportExcel'),
    refreshLogs: document.getElementById('refreshLogs'),
    logsBody: document.getElementById('logsBody'),
    reveals: document.querySelectorAll('.reveal'),
    accuracyChart: document.getElementById('accuracyChart'),
    classChart: document.getElementById('classChart'),
    resetDemo: document.getElementById('resetDemo') // Support for extension hook element
  };

  // Apply layout style transitions smoothly to confidence tracking bars via JS logic safely
  if (DOM.confBar) {
    DOM.confBar.style.transition = "width 0.5s ease";
  }

  // ============================================================
  // STORAGE UTILITIES
  // ============================================================
  const StorageAdapter = {
    setItem: (key, value) => {
      try {
        localStorage.setItem(key, value);
      } catch (e) {
        Logger.warn(`Storage write suppressed: LocalStorage unavailable.`, e);
      }
    },
    getItem: (key) => {
      try {
        return localStorage.getItem(key);
      } catch (e) {
        Logger.warn(`Storage read suppressed: LocalStorage unavailable.`, e);
        return null;
      }
    }
  };

  // ============================================================
  // PRODUCTION TOAST MANAGER
  // ============================================================
  function showToast(type, title, message) {
    if (!DOM.toastContainer) return;

    const activeToasts = DOM.toastContainer.querySelectorAll('.toast');
    if (activeToasts.length >= MAX_TOASTS) {
      const surplusCount = (activeToasts.length - MAX_TOASTS) + 1;
      for (let i = 0; i < surplusCount; i++) {
        if (activeToasts[i]) activeToasts[i].remove();
      }
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconClass = 'fa-info-circle';
    if (type === 'violation' || type === 'error') {
      toast.className = 'toast toast-violation';
      iconClass = 'fa-triangle-exclamation';
    } else if (type === 'safe' || type === 'success') {
      toast.className = 'toast toast-safe';
      iconClass = 'fa-circle-check';
    } else if (type === 'info') {
      iconClass = 'fa-circle-info';
    }

    const timeStr = new Date().toTimeString().split(' ')[0];

    toast.innerHTML = `
      <i class="fa-solid ${iconClass} toast-icon"></i>
      <div class="toast-body">
        <div class="toast-title">${title}</div>
        <div class="toast-msg">${message}</div>
        <div class="toast-time">${timeStr}</div>
      </div>
      <button class="toast-close" aria-label="Dismiss Alert">&times;</button>
    `;

    DOM.toastContainer.appendChild(toast);

    const closeBtn = toast.querySelector('.toast-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => removeToast(toast), { once: true });
    }

    setTimeout(() => {
      if (toast.parentElement) removeToast(toast);
    }, 5000);
  }

  function removeToast(toast) {
    if (!toast || !toast.parentElement) return;
    toast.classList.add('removing');
    toast.addEventListener('animationend', () => {
      toast.remove();
    }, { once: true });
  }

  // ============================================================
  // INITIALIZE PERSISTED SETTINGS
  // ============================================================
  function initLocalStorage() {
    const savedTheme = StorageAdapter.getItem('theme') || 'dark';
    if (DOM.html) DOM.html.setAttribute('data-theme', savedTheme);
    
    if (DOM.themeIcon) {
      DOM.themeIcon.className = savedTheme === 'dark' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
    }
    
    DOM.themeRadios.forEach(radio => {
      radio.checked = (radio.value === savedTheme);
    });

    const savedThreshold = StorageAdapter.getItem('confidenceThreshold') || '50';
    if (DOM.confThreshold) DOM.confThreshold.value = savedThreshold;
    if (DOM.confThreshVal) DOM.confThreshVal.textContent = `${savedThreshold}%`;

    const savedCamSource = StorageAdapter.getItem('cameraSource');
    if (savedCamSource && DOM.camSource) DOM.camSource.value = savedCamSource;
  }
  initLocalStorage();

  // ============================================================
  // NAVBAR & NAVIGATION INTERACTION CONTROLLER
  // ============================================================
  if (DOM.themeToggle) {
    DOM.themeToggle.addEventListener('click', () => {
      if (!DOM.html) return;
      const currentTheme = DOM.html.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

      DOM.html.setAttribute('data-theme', newTheme);
      StorageAdapter.setItem('theme', newTheme);

      if (DOM.themeIcon) {
        DOM.themeIcon.className = newTheme === 'dark' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
      }

      DOM.themeRadios.forEach(radio => {
        radio.checked = (radio.value === newTheme);
      });

      showToast('info', 'Theme Changed', `System interface shifted to ${newTheme} mode.`);
    });
  }

  if (DOM.hamburger && DOM.navLinks) {
    DOM.hamburger.addEventListener('click', (e) => {
      e.stopPropagation();
      DOM.navLinks.classList.toggle('open');
    });

    DOM.navLinksA.forEach(link => {
      link.addEventListener('click', () => {
        DOM.navLinks.classList.remove('open');
        DOM.navLinksA.forEach(item => item.classList.remove('active'));
        link.classList.add('active');
      });
    });

    document.addEventListener('click', (e) => {
      if (DOM.navLinks.classList.contains('open') && !DOM.navLinks.contains(e.target) && !DOM.hamburger.contains(e.target)) {
        DOM.navLinks.classList.remove('open');
      }
    });
  }

  DOM.tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      DOM.tabBtns.forEach(b => b.classList.remove('active'));
      DOM.tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetTabId = `tab-${btn.getAttribute('data-tab')}`;
      const targetContent = document.getElementById(targetTabId);
      if (targetContent) targetContent.classList.add('active');

      if (btn.getAttribute('data-tab') !== 'camera') {
        shutdownWebcamStream();
      }
    });
  });

  // ============================================================
  // VISUAL EFFECTS & TIMERS
  // ============================================================
  function checkScrollReveal() {
    const triggerBottom = window.innerHeight * 0.85;
    DOM.reveals.forEach(reveal => {
      const revealTop = reveal.getBoundingClientRect().top;
      if (revealTop < triggerBottom) {
        reveal.classList.add('visible');
      }
    });
  }
  
  if (DOM.reveals.length > 0) {
    window.addEventListener('scroll', checkScrollReveal, { passive: true });
    checkScrollReveal();
  }

  function triggerDashboardCounters() {
    DOM.counters.forEach(counter => {
      const target = +counter.getAttribute('data-target');
      if (isNaN(target)) return;
      const speed = 60;
      const increment = target / speed;
      let currentCount = 0;

      const updateCounter = () => {
        currentCount += increment;
        if (currentCount < target) {
          counter.textContent = Math.ceil(currentCount);
          setTimeout(updateCounter, 15);
        } else {
          counter.textContent = target;
        }
      };
      updateCounter();
    });
  }
  triggerDashboardCounters();

  function runSystemClock() {
    const clockLoop = () => {
      if (DOM.monitorTime) {
        DOM.monitorTime.textContent = new Date().toTimeString().split(' ')[0];
      }
      setTimeout(clockLoop, 1000);
    };
    clockLoop();
  }
  runSystemClock();

  // ============================================================
  // MEDIA MANAGEMENT & RESOURCE DISPOSAL
  // ============================================================
  function clearMonitorVisualNodes() {
    if (DOM.webcamFeed) DOM.webcamFeed.style.display = 'none';
    
    if (DOM.uploadedPreview) {
      DOM.uploadedPreview.src = FALLBACK_PREVIEW;
      DOM.uploadedPreview.style.display = 'block';
    }

    if (DOM.mainMonitor) {
      const dynamicVid = DOM.mainMonitor.querySelector('.dynamic-video-node');
      if (dynamicVid) {
        dynamicVid.pause();
        dynamicVid.removeAttribute('src');
        dynamicVid.load();
        dynamicVid.remove();
      }
    }

    if (currentActiveFileUrl) {
      URL.revokeObjectURL(currentActiveFileUrl);
      currentActiveFileUrl = null;
    }
  }

  function handleGenericInboundFile(file) {
    if (!file) return;
    try {
      clearMonitorVisualNodes();
      shutdownWebcamStream();

      if (file.type.startsWith('image/')) {
        currentActiveFileUrl = URL.createObjectURL(file);
        if (DOM.uploadedPreview) {
          DOM.uploadedPreview.src = currentActiveFileUrl;
          DOM.uploadedPreview.style.display = 'block';
        }
        showToast('safe', 'Image Uploaded', `File active: "${file.name}"`);
      } else if (file.type.startsWith('video/')) {
        if (DOM.uploadedPreview) DOM.uploadedPreview.style.display = 'none';
        
        currentActiveFileUrl = URL.createObjectURL(file);
        const videoElement = document.createElement('video');
        videoElement.className = 'dynamic-video-node';
        videoElement.autoplay = true;
        videoElement.muted = true;
        videoElement.loop = true;
        videoElement.playsInline = true;
        videoElement.style.cssText = 'width:100%; height:100%; object-fit:cover; border-radius:8px;';
        videoElement.src = currentActiveFileUrl;

        if (DOM.mainMonitor) {
          DOM.mainMonitor.insertBefore(videoElement, DOM.bbox1);
        }
        showToast('info', 'Video Uploaded', `File active: "${file.name}"`);
      } else {
        showToast('error', 'Incompatible Format', 'Please upload a standard image or video file.');
      }
    } catch (err) {
      showToast('error', 'Ingestion Error', 'Failed to process the uploaded file.');
      Logger.error(err);
    }
  }

  if (DOM.uploadImage) {
    DOM.uploadImage.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) handleGenericInboundFile(e.target.files[0]);
    });
  }
  if (DOM.uploadVideo) {
    DOM.uploadVideo.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) handleGenericInboundFile(e.target.files[0]);
    });
  }

  if (DOM.dropZone) {
    ['dragenter', 'dragover'].forEach(name => {
      DOM.dropZone.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        DOM.dropZone.classList.add('drag-over');
      }, false);
    });

    ['dragleave', 'drop'].forEach(name => {
      DOM.dropZone.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        DOM.dropZone.classList.remove('drag-over');
      }, false);
    });

    DOM.dropZone.addEventListener('drop', (e) => {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleGenericInboundFile(e.dataTransfer.files[0]);
      }
    }, false);
  }

  // ============================================================
  // WEBCAM & EXTERNAL SOURCE INPUTS
  // ============================================================
  if (DOM.startWebcam) {
    DOM.startWebcam.addEventListener('click', async () => {
      clearMonitorVisualNodes();
      shutdownWebcamStream();

      try {
        webcamStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, facingMode: "user" },
          audio: false
        });
        if (DOM.webcamFeed) {
          DOM.webcamFeed.srcObject = webcamStream;
          DOM.webcamFeed.style.display = 'block';
        }
        if (DOM.uploadedPreview) DOM.uploadedPreview.style.display = 'none';
        showToast('safe', 'Camera Connected', 'Camera connected successfully.');
      } catch (err) {
        showToast('error', 'Connection Failed', 'Could not access webcam. Please check system permissions.');
        Logger.error(err);
      }
    });
  }

  function shutdownWebcamStream() {
    if (webcamStream) {
      webcamStream.getTracks().forEach(track => track.stop());
      webcamStream = null;
    }
    if (DOM.webcamFeed) {
      DOM.webcamFeed.srcObject = null;
      DOM.webcamFeed.style.display = 'none';
    }
  }

  if (DOM.stopWebcam) {
    DOM.stopWebcam.addEventListener('click', () => {
      shutdownWebcamStream();
      if (DOM.uploadedPreview) {
        DOM.uploadedPreview.style.display = 'block';
        DOM.uploadedPreview.src = FALLBACK_PREVIEW;
      }
      showToast('info', 'Camera Disconnected', 'Camera disconnected.');
    });
  }

  if (DOM.connectCam) {
    DOM.connectCam.addEventListener('click', () => {
      const urlString = DOM.ipCamUrl ? DOM.ipCamUrl.value.trim() : '';
      if (!urlString) {
        showToast('error', 'Endpoint Error', 'Please enter a valid camera URL.');
        return;
      }
      clearMonitorVisualNodes();
      shutdownWebcamStream();
      if (DOM.uploadedPreview) {
        DOM.uploadedPreview.style.display = 'block';
        DOM.uploadedPreview.src = 'https://placehold.co/700x400/1a1a1a/40c4ff?text=IP+CAMERA+STREAM+ACTIVE';
      }
      showToast('info', 'Camera Connected', `Camera connected successfully.`);
    });
  }

  // ============================================================
  // PRESENTATION STATE-DRIVEN DETECTION SCANNING ARCHITECTURE
  // ============================================================
  function startDetection() {
    if (isDetectionRunning && !isDetectionPaused) return;

    if (detectionInterval) clearInterval(detectionInterval);
    
    if (isDetectionPaused) {
      resumeDetection();
      return;
    }

    isDetectionRunning = true;
    isDetectionPaused = false;

    if (DOM.detectionStatus) {
      DOM.detectionStatus.className = 'status-running';
      DOM.detectionStatus.innerHTML = '<i class="fa-solid fa-circle-dot pulse-green"></i> Detection Running';
    }
    showToast('success', 'Detection Started', 'Helmet Detection System is now running.');

    runDetectionLoop();
  }

  function resumeDetection() {
    isDetectionRunning = true;
    isDetectionPaused = false;

    if (DOM.detectionStatus) {
      DOM.detectionStatus.className = 'status-running';
      DOM.detectionStatus.innerHTML = '<i class="fa-solid fa-circle-dot pulse-green"></i> Detection Running';
    }
    showToast('success', 'Detection Resumed', 'Detection resumed.');
    
    runDetectionLoop();
  }

  function pauseDetection() {
    if (!isDetectionRunning || isDetectionPaused) return;
    
    clearInterval(detectionInterval);
    detectionInterval = null;
    isDetectionPaused = true;
    
    if (DOM.detectionStatus) {
      DOM.detectionStatus.className = 'status-paused';
      DOM.detectionStatus.innerHTML = '<i class="fa-solid fa-pause-circle"></i> Detection Paused';
    }
    showToast('info', 'Detection Paused', 'Detection paused.');
  }

  function stopDetection() {
    if (!isDetectionRunning && !isDetectionPaused) return;

    if (detectionInterval) {
      clearInterval(detectionInterval);
      detectionInterval = null;
    }
    isDetectionRunning = false;
    isDetectionPaused = false;

    if (DOM.bbox1) DOM.bbox1.style.display = 'none';
    if (DOM.bbox2) DOM.bbox2.style.display = 'none';

    if (DOM.detectionStatus) {
      DOM.detectionStatus.className = 'status-idle';
      DOM.detectionStatus.innerHTML = '<i class="fa-solid fa-circle-stop"></i> Detection Stopped';
    }
    showToast('info', 'Detection Stopped', 'Detection stopped.');
  }

  function runDetectionLoop() {
    detectionInterval = setInterval(() => {
      const calculatedConfidence = Math.floor(Math.random() * (99 - 80 + 1)) + 80;
      const currentThreshold = Number(StorageAdapter.getItem('confidenceThreshold') || '50');

      // Filter detection results out if below active threshold parameters
      if (calculatedConfidence < currentThreshold) {
        return; 
      }

      const rollSampleClass = Math.random() > 0.45 ? 'safe' : 'violation';

      if (DOM.confValue) DOM.confValue.textContent = `${calculatedConfidence}%`;
      if (DOM.confBar) DOM.confBar.style.width = `${calculatedConfidence}%`;

      if (rollSampleClass === 'safe') {
        if (DOM.bbox1) {
          DOM.bbox1.style.display = 'block';
          const label = DOM.bbox1.querySelector('.bbox-label');
          if (label) label.textContent = `Helmet ✓ ${calculatedConfidence}%`;
        }
        if (DOM.bbox2) DOM.bbox2.style.display = 'none';

        statsState.safe++;
        statsState.total++;
        updateDOMCounters();
        appendNewModelActivityLog('safe', calculatedConfidence);
      } else {
        if (DOM.bbox1) DOM.bbox1.style.display = 'none';
        if (DOM.bbox2) {
          DOM.bbox2.style.display = 'block';
          const label = DOM.bbox2.querySelector('.bbox-label');
          if (label) label.textContent = `No Helmet ✗ ${calculatedConfidence}%`;
        }

        statsState.violation++;
        statsState.total++;
        updateDOMCounters();
        appendNewModelActivityLog('violation', calculatedConfidence);
        showToast('error', 'No Helmet Detected', `No Helmet Detected (${calculatedConfidence}%).`);
      }
    }, 3500);
  }

  // Bind State Controllers to Interactive Framework
  if (DOM.startDetection) DOM.startDetection.addEventListener('click', startDetection);
  if (DOM.pauseDetection) DOM.pauseDetection.addEventListener('click', pauseDetection);
  if (DOM.stopDetection) DOM.stopDetection.addEventListener('click', stopDetection);

  // ============================================================
  // DATA TABLE DISPATCHERS & RENDER UTILITIES
  // ============================================================
  function appendNewModelActivityLog(status, score) {
    const timestampStr = new Date().toTimeString().split(' ')[0];
    const logItemElement = document.createElement('li');

    if (status === 'safe') {
      logItemElement.className = 'feed-item safe';
      logItemElement.innerHTML = `<span class="feed-badge safe"><i class="fa-solid fa-check"></i></span><span class="feed-text">Helmet Detected (${score}%)</span><span class="feed-time">${timestampStr}</span>`;
    } else {
      logItemElement.className = 'feed-item violation';
      logItemElement.innerHTML = `<span class="feed-badge violation"><i class="fa-solid fa-exclamation"></i></span><span class="feed-text">No Helmet Detected (${score}%)</span><span class="feed-time">${timestampStr}</span>`;
    }

    if (DOM.activityFeed) {
      DOM.activityFeed.insertBefore(logItemElement, DOM.activityFeed.firstChild);
      if (DOM.activityFeed.children.length > 30) {
        DOM.activityFeed.lastChild.remove();
      }
    }

    logIdCounter++;
    const placeholderImgUrl = status === 'safe' ? 'https://placehold.co/48x32/1a1a1a/00e676?text=H' : 'https://placehold.co/48x32/1a1a1a/ff5252?text=NH';

    logsData.unshift({
      no: logIdCounter,
      timestamp: timestampStr,
      snapshot: placeholderImgUrl,
      status: status,
      confidence: `${score}%`
    });

    executeLogsFilteringOperation();
  }

  function renderLogsTableEngine(dataset) {
    if (!DOM.logsBody) return;
    DOM.logsBody.innerHTML = '';

    if (dataset.length === 0) {
      DOM.logsBody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);">No matching records found.</td></tr>`;
      return;
    }

    const memoryFragment = document.createDocumentFragment();

    dataset.forEach(row => {
      const rowTr = document.createElement('tr');
      const badgeClass = row.status === 'safe' ? 'status-badge safe' : 'status-badge violation';
      const visibleStatusText = row.status === 'safe' ? 'Helmet Detected' : 'No Helmet Detected';

      rowTr.innerHTML = `
        <td>${row.no}</td>
        <td>${row.timestamp}</td>
        <td><img src="${row.snapshot}" class="snap-thumb" alt="Log Frame Snapshot" /></td>
        <td><span class="${badgeClass}">${visibleStatusText}</span></td>
        <td><span class="conf-pill">${row.confidence}</span></td>
      `;
      memoryFragment.appendChild(rowTr);
    });

    DOM.logsBody.appendChild(memoryFragment);
  }

  function executeLogsFilteringOperation() {
    const searchString = DOM.logsSearch ? DOM.logsSearch.value.toLowerCase().trim() : '';
    const dropdownChoice = DOM.logsFilter ? DOM.logsFilter.value : 'all';

    const processedDataset = logsData.filter(item => {
      const matchText = 
        item.timestamp.toLowerCase().includes(searchString) || 
        item.confidence.toLowerCase().includes(searchString) || 
        item.status.toLowerCase().includes(searchString) || 
        String(item.no).includes(searchString);
        
      const matchFilter = (dropdownChoice === 'all') || (item.status === dropdownChoice);
      return matchText && matchFilter;
    });

    renderLogsTableEngine(processedDataset);
  }

  if (DOM.logsSearch) DOM.logsSearch.addEventListener('input', executeLogsFilteringOperation);
  if (DOM.logsFilter) DOM.logsFilter.addEventListener('change', executeLogsFilteringOperation);

  if (DOM.refreshLogs) {
    DOM.refreshLogs.addEventListener('click', () => {
      logsData = [...initialLogsCache];
      logIdCounter = logsData.length;
      if (DOM.logsSearch) DOM.logsSearch.value = '';
      if (DOM.logsFilter) DOM.logsFilter.value = 'all';
      renderLogsTableEngine(logsData);
      showToast('success', 'Logs Refreshed', 'Logs refreshed successfully.');
    });
  }

  // ============================================================
  // UNIVERSAL MULTI-PLATFORM TABULAR DATA DATA EXPORTS
  // ============================================================
  function escapeCsvToken(token) {
    const stringified = String(token);
    if (stringified.includes(',') || stringified.includes('"') || stringified.includes('\n') || stringified.includes('\r')) {
      return `"${stringified.replace(/"/g, '""')}"`;
    }
    return stringified;
  }

  if (DOM.exportCSV) {
    DOM.exportCSV.addEventListener('click', () => {
      try {
        let textCsvData = 'No,Timestamp,Status,Confidence\r\n';
        logsData.forEach(row => {
          const exportLabel = row.status === 'safe' ? 'Helmet Detected' : 'No Helmet Detected';
          textCsvData += `${escapeCsvToken(row.no)},${escapeCsvToken(row.timestamp)},${escapeCsvToken(exportLabel)},${escapeCsvToken(row.confidence)}\r\n`;
        });

        const dataBlob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), textCsvData], { type: 'text/csv;charset=utf-8;' });
        const temporaryUrl = URL.createObjectURL(dataBlob);
        const downloadTrigger = document.createElement('a');
        
        downloadTrigger.href = temporaryUrl;
        downloadTrigger.download = `HelmetVision_Logs_${Date.now()}.csv`;
        document.body.appendChild(downloadTrigger);
        downloadTrigger.click();
        
        document.body.removeChild(downloadTrigger);
        URL.revokeObjectURL(temporaryUrl);
        showToast('safe', 'CSV Exported', 'CSV Exported');
      } catch (err) {
        showToast('error', 'Export Failed', 'An error occurred during data file creation.');
        Logger.error(err);
      }
    });
  }

  if (DOM.exportExcel) {
    DOM.exportExcel.addEventListener('click', () => {
      try {
        let xmlTemplate = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">`;
        xmlTemplate += `<head><meta charset="utf-8"/></head><body>`;
        xmlTemplate += `<table border="1px"><thead><tr style="background-color:#1a1a1a;color:#fff;"><th>No</th><th>Timestamp</th><th>Status</th><th>Confidence Score</th></tr></thead><tbody>`;

        logsData.forEach(row => {
          const exportLabel = row.status === 'safe' ? 'Helmet Detected' : 'No Helmet Detected';
          xmlTemplate += `<tr><td>${row.no}</td><td>${row.timestamp}</td><td>${exportLabel}</td><td>${row.confidence}</td></tr>`;
        });

        xmlTemplate += `</tbody></table></body></html>`;

        const spreadBlob = new Blob([xmlTemplate], { type: 'application/vnd.ms-excel;charset=utf-8' });
        const spreadUrl = URL.createObjectURL(spreadBlob);
        const processingLink = document.createElement('a');
        
        processingLink.href = spreadUrl;
        processingLink.download = `HelmetVision_Logs_${Date.now()}.xls`;
        document.body.appendChild(processingLink);
        processingLink.click();
        
        document.body.removeChild(processingLink);
        URL.revokeObjectURL(spreadUrl);
        showToast('safe', 'Excel Exported', 'Excel Exported');
      } catch (err) {
        showToast('error', 'Export Failed', 'An error occurred during sheet structure rendering.');
        Logger.error(err);
      }
    });
  }

  // ============================================================
  // MODAL PARAMETER INTERFACE HANDLERS
  // ============================================================
  if (DOM.openSettings && DOM.settingsModal) {
    DOM.openSettings.addEventListener('click', () => DOM.settingsModal.classList.add('open'));
  }
  if (DOM.closeSettings && DOM.settingsModal) {
    DOM.closeSettings.addEventListener('click', () => DOM.settingsModal.classList.remove('open'));
  }
  if (DOM.settingsModal) {
    DOM.settingsModal.addEventListener('click', (e) => {
      if (e.target === DOM.settingsModal) DOM.settingsModal.classList.remove('open');
    });
  }
  if (DOM.confThreshold) {
    DOM.confThreshold.addEventListener('input', (e) => {
      if (DOM.confThreshVal) DOM.confThreshVal.textContent = `${e.target.value}%`;
    });
  }

  if (DOM.saveSettings) {
    DOM.saveSettings.addEventListener('click', () => {
      const pickedThreshold = DOM.confThreshold ? DOM.confThreshold.value : '50';
      const pickedSource = DOM.camSource ? DOM.camSource.value : 'Built-in Webcam';
      const selectedThemeObj = document.querySelector('input[name="theme"]:checked');
      const pickedTheme = selectedThemeObj ? selectedThemeObj.value : 'dark';

      StorageAdapter.setItem('confidenceThreshold', pickedThreshold);
      StorageAdapter.setItem('cameraSource', pickedSource);
      StorageAdapter.setItem('theme', pickedTheme);

      if (DOM.html) DOM.html.setAttribute('data-theme', pickedTheme);
      if (DOM.themeIcon) {
        DOM.themeIcon.className = pickedTheme === 'dark' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
      }

      DOM.themeRadios.forEach(radio => {
        radio.checked = (radio.value === pickedTheme);
      });

      if (DOM.settingsModal) DOM.settingsModal.classList.remove('open');
      
      showToast('success', 'Settings Saved', `Settings Saved Successfully<br>• Current Threshold: ${pickedThreshold}%<br>• Camera Source: ${pickedSource}`);
    });
  }

  // ============================================================
  // PRESENTATION DEMO RESET UTILITY HOOK
  // ============================================================
  if (DOM.resetDemo) {
    DOM.resetDemo.addEventListener('click', () => {
      // 1. Terminate Active Loops safely
      stopDetection();

      // 2. Clear out state counters using pristine source template maps
      Object.assign(statsState, PROJECT_STATS);
      updateDOMCounters();

      // 3. Rebuild core database tracking structures
      logsData = [...initialLogsCache];
      logIdCounter = logsData.length;
      if (DOM.logsSearch) DOM.logsSearch.value = '';
      if (DOM.logsFilter) DOM.logsFilter.value = 'all';
      renderLogsTableEngine(logsData);

      // 4. Reset activity updates feed clean state
      if (DOM.activityFeed) DOM.activityFeed.innerHTML = '';

      // 5. Restore tracking configuration indicators safely
      if (DOM.confValue) DOM.confValue.textContent = "94%";
      if (DOM.confBar) DOM.confBar.style.width = "94%";

      // 6. Display confirmation context banner metrics alert
      showToast('success', 'Demo Reset', 'Demo reset successfully.');
    });
  }

  // ============================================================
  // RE-ENTRANT GRAPHICAL ANALYTICS METRICS HOOKS (CHART.JS)
  // ============================================================
  function initializeChartsEngine() {
    try {
      if (typeof Chart === 'undefined') {
        Logger.warn('Dependency alert: Chart.js library structure context unreachable.');
        return;
      }

      // 1. Validation Accuracy Profile
      if (DOM.accuracyChart) {
        if (accuracyChartInstance) accuracyChartInstance.destroy();
        
        accuracyChartInstance = new Chart(DOM.accuracyChart.getContext('2d'), {
          type: 'line',
          data: {
            labels: ['Ep 10', 'Ep 20', 'Ep 30', 'Ep 40', 'Ep 50', 'Ep 60', 'Ep 70', 'Ep 80', 'Ep 90', 'Ep 100'],
            datasets: [{
              label: 'Validation Accuracy',
              data: [...PROJECT_CONFIG.validationAccuracy],
              borderColor: '#FFCC00',
              backgroundColor: 'rgba(255, 204, 0, 0.08)',
              borderWidth: 2,
              fill: true,
              tension: 0.3,
              pointRadius: 3
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: function(context) {
                    return `Accuracy: ${context.parsed.y}%`;
                  }
                }
              }
            },
            scales: {
              y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#888' }, min: 60, max: 100 },
              x: { grid: { display: false }, ticks: { color: '#888' } }
            }
          }
        });
      }

      // 2. Training Dataset Class Distribution
      if (DOM.classChart) {
        if (classChartInstance) classChartInstance.destroy();

        classChartInstance = new Chart(DOM.classChart.getContext('2d'), {
          type: 'bar',
          data: {
            labels: ['Helmet Class', 'No Helmet Class'],
            datasets: [{
              label: 'Dataset Distribution',
              data: [PROJECT_CONFIG.datasetHelmet, PROJECT_CONFIG.datasetNoHelmet],
              backgroundColor: ['rgba(0, 230, 118, 0.65)', 'rgba(255, 23, 68, 0.65)'],
              borderColor: ['#00e676', '#ff1744'],
              borderWidth: 1,
              barThickness: 40
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: function(context) {
                    const labelText = context.label || '';
                    return `${labelText} Images: ${context.parsed.y}`;
                  }
                }
              }
            },
            scales: {
              y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#888' }, beginAtZero: true },
              x: { grid: { display: false }, ticks: { color: '#888' } }
            }
          }
        });
      }
    } catch (chartErr) {
      Logger.error("Graphics system initialization breakdown: ", chartErr);
    }
  }

  // ============================================================
  // AUTOMATED MEMORY GARBAGE DISPOSAL CONTEXTS
  // ============================================================
  window.addEventListener('beforeunload', () => {
    if (detectionInterval) {
      clearInterval(detectionInterval);
      detectionInterval = null;
    }

    shutdownWebcamStream();

    if (DOM.mainMonitor) {
      const dynamicVid = DOM.mainMonitor.querySelector('.dynamic-video-node');
      if (dynamicVid) {
        dynamicVid.pause();
        dynamicVid.removeAttribute('src');
        dynamicVid.load();
      }
    }
    if (currentActiveFileUrl) {
      URL.revokeObjectURL(currentActiveFileUrl);
    }

    if (accuracyChartInstance) {
      accuracyChartInstance.destroy();
      accuracyChartInstance = null;
    }
    if (classChartInstance) {
      classChartInstance.destroy();
      classChartInstance = null;
    }
  });

  // Main Runtime Subsystem Execution Initializations
  renderLogsTableEngine(logsData);
  initializeChartsEngine();
});