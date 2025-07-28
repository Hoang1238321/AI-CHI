// Ultra-minimal security for mobile blocking - ES3 compatible
var SecurityManager = (function() {
  var initialized = false;
  
  function init() {
    if (initialized) return;
    
    // Security initialization - mobile users can now access the app normally
    // Authentication blocking is handled by the backend only
    console.log('Security manager initialized - mobile access enabled');
    
    initialized = true;
  }
  
  return {
    init: init
  };
})();

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SecurityManager: SecurityManager };
} else {
  // For ES6 import/export - declare for TypeScript
  (window as any).SecurityManager = SecurityManager;
}

export { SecurityManager };