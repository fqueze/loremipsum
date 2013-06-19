var PRTC = PRTC || {};

PRTC.game = {  
  stop: false,
  modules: [
    'scene',
    
    'level',
    'ball',
    'paddle',
    'block',
  ],
  
  blocksDestroyed: 0,
  
  keyboard: new THREEx.KeyboardState(),
  updatable: [],
  
  init: function game_init() {
    this.modules.forEach(this.initModule, this);
    this.loop.ctx = this.loop.bind(this);
    this.loop.ctx();
    
    var blocks = [];
    for (var i=0; i< PRTC.block.numberOfBlocks; i++) {
      blocks.push(PRTC.block.create());
    }
    
    PRTC.ball.addCollidingObjects(blocks);
    
  },
  
  initModule: function game_initModule(module) {
    module = PRTC[module] || null;
    if (!module)
      return;
      
    if (module.init && typeof module.init === 'function') {
      module.init();
      module.init = false;
    }
    
    if (module.updatable) {
      this.updatable.push(module);
    }
  },
  
  updateModules: function game_updateModules() {
    this.updatable.forEach(function(module) {
      module.update();
    });
  },
  
  loop: function game_loop() {
    this.updateModules();
    PRTC.scene.render();
    if (!this.stop) {
      window.requestAnimationFrame(this.loop.ctx);
    }
  }
}

PRTC.game.init();