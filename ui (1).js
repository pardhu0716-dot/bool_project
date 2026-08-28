/**
 * BoolSynth UI & Top-Level Navigation Controller
 * Manages module tabs, URL hash synchronization, and cross-module bridges.
 */
(function () {
  'use strict';

  const moduleTabs = document.querySelectorAll('.nav-tab-btn');
  const modulePanels = document.querySelectorAll('.module-panel');
  const moduleHooks = {};

  function registerModuleHook(moduleName, onActivate) {
    moduleHooks[moduleName] = onActivate;
  }

  function switchTab(targetId) {
    const targetPanel = document.getElementById(targetId);
    if (!targetPanel) return;

    moduleTabs.forEach(btn => {
      const match = btn.dataset.target === targetId;
      btn.classList.toggle('active', match);
      btn.setAttribute('aria-selected', match ? 'true' : 'false');
    });

    modulePanels.forEach(panel => {
      const match = panel.id === targetId;
      panel.classList.toggle('active', match);
      panel.hidden = !match;
    });

    // Update URL hash without jumping
    const hash = targetId.replace('module-', '');
    if (history.replaceState) {
      history.replaceState(null, '', '#' + hash);
    } else {
      window.location.hash = hash;
    }

    // Trigger module hook
    if (moduleHooks[targetId]) {
      try {
        moduleHooks[targetId]();
      } catch (err) {
        console.error(`Error activating module hook for ${targetId}:`, err);
      }
    }

    window.dispatchEvent(new CustomEvent('moduleSwitched', { detail: { targetId } }));
  }

  // Bind tab clicks
  moduleTabs.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = btn.dataset.target;
      switchTab(targetId);
    });
  });

  // Handle initial hash routing
  function initFromHash() {
    const rawHash = (window.location.hash || '').replace('#', '').toLowerCase();
    const map = {
      'boolsynth': 'module-boolsynth',
      'synth': 'module-boolsynth',
      'kmaps': 'module-kmaps',
      'kmap': 'module-kmaps',
      'arithmetic': 'module-arithmetic',
      'adder': 'module-arithmetic',
      'subtractor': 'module-arithmetic',
      'mux': 'module-mux',
      'multiplexer': 'module-mux'
    };
    const targetId = map[rawHash] || 'module-boolsynth';
    switchTab(targetId);
  }

  // Toast notification system
  function showToast(message, type = 'info', duration = 3000) {
    let toast = document.getElementById('bs-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'bs-toast';
      toast.className = 'bs-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = `bs-toast show ${type}`;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.classList.remove('show');
    }, duration);
  }

  // Expose global navigation helpers
  window.BoolUI = {
    switchTab,
    registerModuleHook,
    showToast
  };

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFromHash);
  } else {
    initFromHash();
  }
})();
