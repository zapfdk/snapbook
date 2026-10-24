/**
 * A focused reimplementation of the subset of Boost.Serialization's text
 * archive that Playbook Creator uses. Token order, class ids, object ids,
 * object versions and tracking flags are kept identical so the resulting
 * archive can be read by PBC's native C++ loader.
 */

interface ClassMeta {
  id: number
  version: number
  initialized: boolean
}

export class BoostTextArchive {
  private out = ''
  private first = true
  private classes = new Map<string, ClassMeta>()
  private objectIds = new Map<object, number>()
  private nextObjectId = 0
  private encoder = new TextEncoder()

  private separator() {
    if (this.first) {
      this.first = false
      return ''
    }
    return ' '
  }

  raw(token: string | number) {
    this.out += this.separator()
    this.out += String(token)
  }

  num(value: number | boolean) {
    this.raw(Number(value))
  }

  /** C++ default text archive uses std::scientific with max_digits10. */
  float(value: number) {
    if (Object.is(value, -0) || value === 0) {
      this.raw(value < 0 ? '-0.00000000000000000e+00' : '0.00000000000000000e+00')
      return
    }
    let text = value.toExponential(17)
    text = text.replace(/e([+-])(\d)$/, 'e$10$2')
    this.raw(text)
  }

  str(value: string) {
    const bytes = this.encoder.encode(value)
    this.raw(bytes.length)
    this.out += this.separator()
    this.out += value
  }

  private register(type: string, version: number): ClassMeta {
    let meta = this.classes.get(type)
    if (!meta) {
      meta = { id: this.classes.size, version, initialized: false }
      this.classes.set(type, meta)
    }
    return meta
  }

  private idFor(value: object): number {
    let objectId = this.objectIds.get(value)
    if (objectId === undefined) {
      objectId = this.nextObjectId
      this.nextObjectId += 1
      this.objectIds.set(value, objectId)
    }
    return objectId
  }

  /**
   * Save a value-type object (base class, container, colour, array).
   *
   * A class such as PBCCategory also has a pointer serializer, which makes
   * Boost track it even when it is serialized by value as a base object.
   */
  object(
    type: string,
    version: number,
    write: () => void,
    tracked?: { identity: object },
  ) {
    const meta = this.register(type, version)
    if (!meta.initialized) {
      this.num(tracked ? 1 : 0)
      this.num(meta.version)
      meta.initialized = true
    }
    if (tracked) this.raw(this.idFor(tracked.identity))
    write()
  }

  /**
   * Save a boost::shared_ptr<T>: the shared_ptr wrapper itself has class
   * information (version 1, tracking never), followed by the raw T*.
   */
  sharedPtr<T extends object>(
    wrapperType: string,
    type: string,
    version: number,
    value: T | null,
    write: (value: T) => void,
  ) {
    this.object(wrapperType, 1, () => {})
    // Boost registers the pointed-to serializer before checking for null,
    // so a null pointer still consumes the next class id.
    const meta = this.register(type, version)
    if (!value) {
      this.num(-1)
      return
    }
    if (!meta.initialized) {
      this.raw(meta.id)
      this.num(1) // tracked
      this.num(meta.version)
      meta.initialized = true
    } else {
      this.raw(meta.id)
    }

    const alreadyWritten = this.objectIds.has(value)
    this.raw(this.idFor(value))
    if (!alreadyWritten) write(value)
  }

  /** An empty shared_ptr whose wrapper class may or may not be initialized. */
  nullPtr(wrapperType: string) {
    this.object(wrapperType, 1, () => {})
    this.num(-1)
  }

  /** A map's pair value_type contributes one item version number (0). */
  map<V>(
    type: string,
    pairType: string,
    entries: Array<[string, V]>,
    writeValue: (value: V) => void,
  ) {
    this.object(type, 0, () => {
      this.num(entries.length)
      this.num(0) // version<pair<const string, shared_ptr<T>>>
      for (const [key, value] of entries) {
        this.object(pairType, 0, () => {
          this.str(key)
          writeValue(value)
        })
      }
    })
  }

  /** std::vector / std::set of boost::shared_ptr<T> (item version is 1). */
  sharedPtrCollection<T extends object>(
    type: string,
    wrapperType: string,
    elementType: string,
    elementVersion: number,
    items: T[],
    writeItem: (item: T) => void,
  ) {
    this.object(type, 0, () => {
      this.num(items.length)
      this.num(1) // version<boost::shared_ptr<T>>
      for (const item of items) {
        this.sharedPtr(wrapperType, elementType, elementVersion, item, writeItem)
      }
    })
  }

  /** std::array<char, 4> as saved by boost::serialization::array. */
  charArray4(type: string, value: string) {
    this.object(type, 0, () => {
      this.num(4)
      for (let index = 0; index < 4; index += 1) {
        const code = value.charCodeAt(index)
        this.num(Number.isFinite(code) ? code : 0)
      }
    })
  }

  toString() {
    return this.out
  }

}
