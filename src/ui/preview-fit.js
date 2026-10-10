/**
 * Fit the program output inside the available stage without changing its
 * aspect ratio. The WebGL drawing buffer stays at project resolution; only
 * the DOM preview is scaled, like a program monitor in Lumen or Resolume.
 */
export function containSize (contentWidth, contentHeight, boxWidth, boxHeight) {
  const values = [contentWidth, contentHeight, boxWidth, boxHeight].map(Number)
  if (values.some((value) => !Number.isFinite(value) || value <= 0)) {
    return { width: 0, height: 0, scale: 0 }
  }
  const widthScale = boxWidth / contentWidth
  const heightScale = boxHeight / contentHeight
  const scale = Math.min(widthScale, heightScale)
  return {
    width: widthScale <= heightScale ? boxWidth : contentWidth * scale,
    height: heightScale < widthScale ? boxHeight : contentHeight * scale,
    scale
  }
}

export function createPreviewFitter ({ stage, frame, getOutputSize }) {
  let lastKey = ''

  function sync () {
    const output = getOutputSize()
    const style = window.getComputedStyle(stage)
    const availableWidth = stage.clientWidth -
      (Number.parseFloat(style.paddingLeft) || 0) -
      (Number.parseFloat(style.paddingRight) || 0)
    const availableHeight = stage.clientHeight -
      (Number.parseFloat(style.paddingTop) || 0) -
      (Number.parseFloat(style.paddingBottom) || 0)
    const key = `${output.width}x${output.height}:${availableWidth}x${availableHeight}`
    if (key === lastKey) return
    lastKey = key
    const fitted = containSize(output.width, output.height, availableWidth, availableHeight)
    frame.style.width = `${fitted.width}px`
    frame.style.height = `${fitted.height}px`
    frame.dataset.outputSize = `${output.width}×${output.height}`
    frame.dataset.previewScale = fitted.scale.toFixed(4)
  }

  const observer = new ResizeObserver(sync)
  observer.observe(stage)
  sync()

  return {
    sync,
    dispose () {
      observer.disconnect()
    }
  }
}
