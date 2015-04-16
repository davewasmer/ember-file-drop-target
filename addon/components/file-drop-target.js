import Ember from "ember";

export default Ember.Component.extend({

  /**
   * Allow multiple files to be selected at once. The selection action will pass
   * an array of Files rather than a single File if this is true.
   *
   * @type {Boolean}
   */
  allowMultiple: false,

  /**
   * Regular expression used to test if the mime type of the selected file is
   * allowed. If a disallowed file type is dropped on the target, the
   * `invalidFileType` action will be triggered.
   *
   * @type {RegExp}
   */
  allowedTypes: /.+/,


  classNames: 'file-drop-target',

  /**
   * Setup the global event listeners on the body element so we can style
   * everything appropriately. All the listeners are scoped so they don't
   * conflict with other file-drop-target components on the same page.
   */
  setupEventListeners: Ember.on('didInsertElement', function() {
    var $body = Ember.$('body');
    var id = this.get('elementId');

    $body.on(`dragstart.${id}`, this.dragStart.bind(this));
    $body.on(`dragenter.${id} dragleave.${id}`, this.calculateDropCount.bind(this));
    $body.on(`dragover.${id}`, this.dragOver.bind(this));
  }),

  teardownEventListeners: Ember.on('willDestroyElement', function() {
    var id = this.get('elementId');
    [ 'dragenter', 'dragleave', 'dragover', 'drop' ].forEach((event) => {
      var scopedEventName = event + '.' + id;
      Ember.$('body').off(scopedEventName);
      this.$().off(event);
    });
  }),

  /**
   * dragStart is run when the user starts dragging a file from their desktop.
   * The cursor isn't necessarily over the browser window yet.
   *
   * @param {Event} e - the dragstart event from the browser
   */
  dragStart() {
    Ember.$('body').addClass('file-drop-target-dragging');
  },

  // Track enters/exits to get a window-level indicator of dragging
  // https://coderwall.com/p/bwsara

  /**
   * Counts the dragenter and dragleave events to ensure you can style the drop
   * target even if the user drags over child elements (which triggers a
   * dragleave event on the parent target element). Inspired by
   * https://coderwall.com/p/bwsara.
   *
   * Invokes the dragOverElement or dragOffElement hooks when the user mouses
   * over or off the target element, respectively.
   *
   * @param {Event} e - the dragenter or dragleave event from the browser
   */
  calculateDropCount(e) {
    var self = this;
    var $body = Ember.$('body');
    e.preventDefault();

    Ember.$(e.target)              // The actual element that fired the event
    .parents()                     // Get all it's parent elements
    .addBack()                     // Add the target element itself back in
    .filter('.file-drop-target')   // Reduce to just the file-drop-target components
    .add($body)                    // Include the body element itself
    .each(function() {             // Calculate the dropCount and update
      var offset = e.type === 'dragenter' ? 1 : -1;
      var dragCount = (Ember.$(this).data('dragcount') || 0) + offset;
      Ember.$(this).data('dragcount', dragCount);
      if (dragCount > 0) {
        self.dragOverElement(this);
      } else {
        self.dragOffElement(this);
      }
    });
  },

  /**
   * Called when the user drags over the target element. Usually you'll want to
   * add a class to the element to visually indicate that it's a drop target.
   *
   * The default implementation adds .file-drop-target-drag-over
   *
   * @param {DOMElement} element - the DOM element that the user dragged over
   */
  dragOverElement(element) {
    Ember.$(element).addClass('file-drop-target-drag-over');
  },

  /**
   * Called when the user drags off the target element. Usually you'll want to
   * clean up anything you added in dragOverElement.
   *
   * The default implementation remvoes .file-drop-target-drag-over
   *
   * @param {DOMElement} element - the DOM element that the user dragged off
   */
  dragOffElement(element) {
    Ember.$(element).removeClass('file-drop-target-drag-over');
  },

  /**
   * Called when the dragover event fires from the browser. Usually you'll want to
   * (and the default implementation does) handle the dropEffect (i.e. the
   * cursor change to indicate what kind of action dropping will invoke).
   *
   * @param {Event} e - the dragover event from the browser
   */
  dragOver(e) {
    e.preventDefault();
    var dropEffect = this.getDropEffect(e);
    e.originalEvent.dataTransfer.dropEffect = dropEffect;
  },

  /**
   * A convenience hook if you just want customize the dropEffect for the
   * dragover event. The default implementation is to show the 'copy' effect
   * if the user is dragging a file over this file-drop-target.
   *
   * @param {Event} e - the dragover event from the browser
   * @returns {String} the desired dropEffect value (i.e. 'copy')
   */
  getDropEffect() {
    var dropEffect = 'none';
    if (this.$().data('dropcount') > 0) {
      dropEffect = 'copy';
    }
    return dropEffect;
  },

  /**
   * Handle the actual drop event. Resets drop counts, filters out invalid file
   * types, and limits to a single file if allowMultiple is false.
   *
   * @param {Event} e - the drop event from the browser
   */
  drop(e) {
    var allowMultiple = this.get('allowMultiple');
    var allowedTypes = this.get('allowedTypes');

    e.preventDefault();

    // Clean up drag counters
    this.$().add('body').removeData('dragCount');

    var files = e.dataTransfer.files;

    // Kill the event if no files were actually selected
    if (files.length === 0) {
      return;
    // Make sure we limit to a single file it multiple selection isn't allowed
    } else if (files.length > 1 && !allowMultiple) {
      files = [ files[0] ];
    }

    files = files.filter((file) => {
      var isAllowed = file.type.match(allowedTypes);
      if (!isAllowed) {
        this.sendAction('invalidFileType', file);
      }
      return isAllowed;
    });

    files.forEach(this.fileDropped.bind(this));

    if (allowMultiple) {
      this.set('files', files);
    } else {
      this.set('file', files[0]);
    }

  },

  /**
   * A convenience hook in case you want to customize the file object before it
   * is set as the component's file/files value, or if you want to perform any
   * other kind of processing.
   *
   * @param {File} file - the file selected by the user
   */
  fileDropped() {}

});
