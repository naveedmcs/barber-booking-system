/**
 * UI Primitive: Accessible Modal Controller
 */

export class ModalController {
  constructor(modalId, options = {}) {
    this.modalEl = document.getElementById(modalId);
    this.options = {
      onOpen: null,
      onClose: null,
      closeOnEsc: true,
      closeOnBackdrop: true,
      ...options
    };
    this.isOpen = false;
    this.escHandler = this.handleKeydown.bind(this);
    this.backdropHandler = this.handleBackdropClick.bind(this);
  }

  open() {
    if (!this.modalEl) return;
    this.modalEl.classList.remove("hidden");
    this.modalEl.classList.add("flex");
    this.isOpen = true;

    if (this.options.closeOnEsc) {
      document.addEventListener("keydown", this.escHandler);
    }
    if (this.options.closeOnBackdrop) {
      this.modalEl.addEventListener("click", this.backdropHandler);
    }
    if (typeof this.options.onOpen === "function") {
      this.options.onOpen(this.modalEl);
    }
  }

  close() {
    if (!this.modalEl) return;
    this.modalEl.classList.add("hidden");
    this.modalEl.classList.remove("flex");
    this.isOpen = false;

    document.removeEventListener("keydown", this.escHandler);
    this.modalEl.removeEventListener("click", this.backdropHandler);

    if (typeof this.options.onClose === "function") {
      this.options.onClose(this.modalEl);
    }
  }

  handleKeydown(e) {
    if (e.key === "Escape" && this.isOpen) {
      this.close();
    }
  }

  handleBackdropClick(e) {
    if (e.target === this.modalEl) {
      this.close();
    }
  }
}
