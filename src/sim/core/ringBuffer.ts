/** Fixed-capacity ring buffer of numbers or objects; oldest entries are overwritten. */
export class RingBuffer<T> {
  private buf: (T | undefined)[];
  private head = 0; // next write index
  private count = 0;
  constructor(readonly capacity: number) {
    if (capacity < 1) throw new Error("capacity must be >= 1");
    this.buf = new Array(capacity);
  }
  get length(): number {
    return this.count;
  }
  push(v: T): void {
    this.buf[this.head] = v;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
  }
  /** i = 0 is the oldest retained item. */
  at(i: number): T {
    if (i < 0 || i >= this.count) throw new RangeError("index out of range");
    const start = (this.head - this.count + this.capacity) % this.capacity;
    return this.buf[(start + i) % this.capacity] as T;
  }
  last(): T | undefined {
    return this.count ? this.at(this.count - 1) : undefined;
  }
  clear(): void {
    this.head = 0;
    this.count = 0;
  }
  toArray(): T[] {
    const out: T[] = [];
    for (let i = 0; i < this.count; i++) out.push(this.at(i));
    return out;
  }
  /** Drop newest items while predicate holds (used when the timeline is rewound and re-branched). */
  popWhile(pred: (v: T) => boolean): void {
    while (this.count > 0 && pred(this.at(this.count - 1))) {
      this.head = (this.head - 1 + this.capacity) % this.capacity;
      this.count--;
    }
  }
}
