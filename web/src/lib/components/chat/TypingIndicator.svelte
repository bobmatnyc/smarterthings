<script lang="ts">
  /**
   * TypingIndicator - Animated dots for loading state
   *
   * Simple CSS animation component, no props needed
   */
</script>

<div class="typing-indicator">
  <span class="dot"></span>
  <span class="dot"></span>
  <span class="dot"></span>
</div>

<style>
  .typing-indicator {
    display: inline-flex;
    gap: 0.25rem;
    align-items: center;
    padding: 0.5rem;
  }

  .dot {
    width: 0.5rem;
    height: 0.5rem;
    background-color: currentColor;
    border-radius: 50%;
    opacity: 0.4;
    animation: typing-pulse 1.4s infinite;
  }

  .dot:nth-child(1) {
    animation-delay: 0s;
  }

  .dot:nth-child(2) {
    animation-delay: 0.2s;
  }

  .dot:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes typing-pulse {
    0%, 60%, 100% {
      opacity: 0.4;
      transform: scale(1);
    }
    30% {
      opacity: 1;
      transform: scale(1.2);
    }
  }
</style>
