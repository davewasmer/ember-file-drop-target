import Ember from "ember";

const set = Ember.set;
const get = Ember.get;
const bind = Ember.run.bind;
const computed = Ember.computed;
const on = Ember.on;

const FileDropTargetComponent = Ember.Component.extend({

  ///////////////////////////
  // Configuration Options //
  ///////////////////////////

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


  /////////////
  // Yielded //
  /////////////

  isEmpty: computed('isLoading', 'isLoaded', function() {
    return !(get(this, 'isLoading') || get(this, 'isLoaded'));
  }),


  //////////////
  // Internal //
  //////////////

  classNames: 'file-drop-target',
  classNameBindings: [ 'isDraggingOver', 'isDragging', 'isDropped' ],

  /**
   * Setup the global event listeners on the body element so we can style
   * everything appropriately. All the listeners are scoped so they don't
   * conflict with other file-drop-target components on the same page.
   */
  setupEventListeners: on('didInsertElement', function() {
    let $root = this.get('rootElement');
    let id = this.get('elementId');
    $root.on(`dragenter.${id} dragleave.${id}`, bind(this, this.calculateDropCount));
  }),

  teardownEventListeners: on('willDestroyElement', function() {
    let id = this.get('elementId');
    let $root = this.get('rootElement');
    $root.off(`dragenter.${id}`);
    $root.off(`dragleave.${id}`);
  }),

  /**
   * Fired anytime any dragenter or dragleave events are triggered, anywhere
   * in the app.
   *
   * Counts the dragenter and dragleave events to ensure you can style the
   * drop target even if the user drags over child elements (which triggers a
   * dragleave event on the parent target element). Inspired by
   * https://coderwall.com/p/bwsara.
   *
   * We search the target element plus all it's ancestors in case the event
   * was triggered on a child of the drop target. We also include the root
   * element so we can allow drop targets to style themselves as available
   * targets even when they aren't directly hovered over.
   *
   * Invokes the didDragOver or didDragOff hooks when the user
   * mouses over or off the target element, respectively.
   *
   * @param {Event} e - the dragenter or dragleave event from the browser
   */
  calculateDropCount(e) {
    let self = this;
    let $root = this.get('rootElement');
    e.preventDefault();

    Ember.$(e.target)              // The actual element that fired the event
    .parents()                     // Get all it's parent elements
    .addBack()                     // Add the target element itself back in
    .filter('.file-drop-target')   // Reduce to just the file-drop-target components
    .add($root)                    // Include the body element itself
    .each(function() {             // Calculate the dropCount and update
      let offset = e.type === 'dragenter' ? 1 : -1;
      let dragCount = (Ember.$(this).data('dragcount') || 0) + offset;
      Ember.$(this).data('dragcount', dragCount);
      let isRoot = (this === $root.get(0));
      if (dragCount > 0) {
        return isRoot ? self.didDragOverRoot() : self.didDragOver();
      } else {
        return isRoot ? self.didDragOffRoot() : self.didDragOff();
      }
    });
  },

  isDragging: false,
  isDraggingOver: false,

  /**
   * Called when the user drags over the target element. Usually you'll want to
   * add a class to the element to visually indicate that it's a drop target.
   *
   * The default implementation sets isDraggingOver to true, which adds the
   * .file-drop-target-drag-over class
   *
   * @param {DOMElement} element - the DOM element that the user dragged over
   */
  didDragOver() {
    set(this, 'isDraggingOver', true);
  },

  /**
   * Called when the user drags off the target element. Usually you'll want to
   * clean up anything you added in didDragOver.
   *
   * The default implementation sets isDraggingOver to false, which removes the
   * .file-drop-target-drag-over class
   *
   * @param {DOMElement} element - the DOM element that the user dragged off
   */
  didDragOff() {
    set(this, 'isDraggingOver', false);
  },

  /**
   * Called when the user drags off the browser window. Usually you'll want to
   * add a class to the element to visually indicate that it's a drop target.
   *
   * The default implementation sets isDragging to true and adds
   * .file-drop-target-drag-over to the root element.
   */
  didDragOverRoot() {
    let $root = this.get('rootElement');
    set(this, 'isDragging', true);
    $root.addClass('file-drop-target-drag-over');
  },

  /**
   * Called when the user drags off the browser window. Usually you'll want to
   * clean up anything you added in didDragOver.
   *
   * The default implementation sets isDragging to false and removes
   * .file-drop-target-drag-over from the root element.
   */
  didDragOffRoot() {
    let $root = this.get('rootElement');
    set(this, 'isDragging', false);
    $root.removeClass('file-drop-target-drag-over');
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
    let dropEffect = 'none';
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
    let allowMultiple = this.get('allowMultiple');
    let allowedTypes = this.get('allowedTypes');

    e.preventDefault();

    // Clean up drag counters
    this.didDragOff();
    this.didDragOffRoot();
    Ember.$('.file-drop-target')
    .add(this.get('rootElement'))
    .removeData('dragcount');

    let files = e.dataTransfer.files;

    // Kill the event if no files were actually selected
    if (files.length === 0) {
      return;
    // Make sure we limit to a single file it multiple selection isn't allowed
    } else if (files.length > 1 && !allowMultiple) {
      files = files.slice(0, 1);
    }

    files = Array.prototype.filter.call(files, (file) => {
      let isAllowed = file.type.match(allowedTypes);
      if (!isAllowed && this.invalidFileType) {
        this.invalidFileType(file);
      }
      return isAllowed;
    });

    set(this, 'isDropped', true);
    files.forEach(this.fileWasDropped.bind(this));

    if (allowMultiple) {
      set(this, 'files', files);
    } else {
      set(this, 'file', files[0]);
    }

  },

  fileWasDropped(file) {
    if (this.fileDropped) {
      this.fileDropped(file);
    }
  },

  /**
   * Because the HTML5 DnD API is mildly ridiculous ...
   */
  dragOver(e) { e.preventDefault(); },
  dragEnter(e) { e.preventDefault(); },

  rootElement: computed(function() {
    return Ember.$(this.container.lookup('application:main').rootElement);
  })

});

FileDropTargetComponent.reopenClass({
  positionalParams: [ 'file' ]
});

export default FileDropTargetComponent;
