export class WebRecorder {
  private stream?: MediaStream
  private rec?: MediaRecorder
  private chunks: BlobPart[] = []

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    this.rec = new MediaRecorder(this.stream)
    this.chunks = []
    this.rec.ondataavailable = e => this.chunks.push(e.data)
    this.rec.start()
  }

  async stop(): Promise<Blob> {
    if (!this.rec) throw new Error('not recording')
    await new Promise<void>(resolve => {
      this.rec!.onstop = () => resolve()
      this.rec!.stop()
    })
    this.stream?.getTracks().forEach(t => t.stop())
    return new Blob(this.chunks, { type: this.rec!.mimeType || 'audio/webm' })
  }
}
