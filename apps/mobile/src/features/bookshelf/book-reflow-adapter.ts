import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import type { DOMAdapter, XMLDocument, XMLElement } from 'rebook';

type XMLNode = { nodeType: number; textContent: string | null; parentNode: XMLElement | null };
type XMLText = XMLNode & { nodeType: 3; textContent: string };
type ResourceURLData = { data: string | ArrayBuffer | Blob; mimeType: string };
interface URLFactory { createURL(data: string | ArrayBuffer | Blob, mimeType?: string): string; revokeURL(url: string): void; getData?(url: string): ResourceURLData | undefined; }

function childElements(element: { childNodes?: { length: number; item(index: number): { nodeType: number } | null } }): Array<{ nodeType: number }> {
  const children: Array<{ nodeType: number }> = [];
  const nodes = element.childNodes;
  if (!nodes) return children;
  for (let index = 0; index < nodes.length; index += 1) {
    const child = nodes.item(index);
    if (child?.nodeType === 1) children.push(child);
  }
  return children;
}

function normalizeHtmlVoidTags(value: string): string {
  return value.replace(/<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)(\s[^<>]*?)?>/gi, (match) => match.endsWith('/>') ? match : `${match.slice(0, -1)}/>`);
}

function parseDocument(value: string, mimeType: 'application/xml' | 'text/html') {
  return new DOMParser({
    onError: (level, message) => {
      if (level === 'warning' && message.includes('Unexpected doctype.systemId in HTML document')) return;
      if (level === 'fatalError') throw new Error(message);
      console.error(`[xmldom ${level}] ${message}`);
    },
  }).parseFromString(value, mimeType);
}

class MobileXmlElement implements XMLElement {
  constructor(readonly native: any) {}

  get nodeType(): 1 { return 1; }
  get localName(): string { return this.native.localName; }
  get namespaceURI(): string | null { return this.native.namespaceURI ?? null; }
  get parentNode(): XMLElement | null { return this.native.parentNode?.nodeType === 1 ? new MobileXmlElement(this.native.parentNode) : null; }
  get children(): XMLElement[] { return childElements(this.native).map((child) => new MobileXmlElement(child)); }
  get textContent(): string | null { return this.native.textContent; }
  set textContent(value: string | null) { this.native.textContent = value ?? ''; }
  get attributes() { return Array.from(this.native.attributes ?? []).map((attribute: any) => ({ localName: attribute.localName, namespaceURI: attribute.namespaceURI ?? null, value: attribute.value })); }
  getAttribute(name: string): string | null { return this.native.getAttribute(name); }
  getAttributeNS(namespace: string | null, name: string): string | null { return this.native.getAttributeNS(namespace, name); }
  hasAttribute(name: string): boolean { return this.native.hasAttribute(name); }
  setAttribute(name: string, value: string): void { this.native.setAttribute(name, value); }
  setAttributeNS(namespace: string | null, name: string, value: string): void { this.native.setAttributeNS(namespace, name, value); }
  querySelector(selector: string): XMLElement | null {
    if (selector.startsWith('#')) {
      const element = this.native.ownerDocument?.getElementById(selector.slice(1));
      return element ? new MobileXmlElement(element) : null;
    }
    const match = selector.match(/^\[(\w+)="([^"]+)"\]$/);
    if (match) return this.findByAttribute(match[1], match[2]);
    return null;
  }
  querySelectorAll(selector: string): XMLElement[] {
    if (/^[a-zA-Z][\w-]*$/.test(selector)) return Array.from(this.native.getElementsByTagName(selector)).map((element: any) => new MobileXmlElement(element));
    if (selector.startsWith('[')) {
      const match = selector.match(/^\[(?:\*\|)?(\w+)\]/);
      if (!match) return [];
      return this.findAllByAttribute(match[1]);
    }
    return [];
  }
  getElementsByTagNameNS(namespace: string, name: string): XMLElement[] { return Array.from(this.native.getElementsByTagNameNS(namespace, name)).map((element: any) => new MobileXmlElement(element)); }
  getElementsByTagName(name: string): XMLElement[] { return Array.from(this.native.getElementsByTagName(name)).map((element: any) => new MobileXmlElement(element)); }
  get ownerDocument(): XMLDocument | null { return this.native.ownerDocument ? new MobileXmlDocument(this.native.ownerDocument) : null; }
  lookupNamespaceURI(prefix: string | null): string | null { return this.native.lookupNamespaceURI(prefix) ?? null; }
  lookupPrefix(namespace: string): string | null { return this.native.lookupPrefix(namespace) ?? null; }

  private findByAttribute(name: string, value: string): XMLElement | null {
    if (this.native.getAttribute(name) === value) return this;
    for (const child of childElements(this.native)) {
      const found = new MobileXmlElement(child).findByAttribute(name, value);
      if (found) return found;
    }
    return null;
  }

  findAllByAttribute(name: string): XMLElement[] {
    const result: XMLElement[] = [];
    if (this.native.hasAttribute(name) || this.native.getAttributeNS('http://www.w3.org/1999/xlink', name)) result.push(this);
    for (const child of childElements(this.native)) result.push(...new MobileXmlElement(child).findAllByAttribute(name));
    return result;
  }
}

class MobileXmlDocument implements XMLDocument {
  constructor(readonly native: any) {}

  get documentElement(): XMLElement { return new MobileXmlElement(this.native.documentElement); }
  getElementById(id: string): XMLElement | null { const element = this.native.getElementById(id); return element ? new MobileXmlElement(element) : null; }
  getElementsByTagNameNS(namespace: string, name: string): XMLElement[] { return Array.from(this.native.getElementsByTagNameNS(namespace, name)).map((element: any) => new MobileXmlElement(element)); }
  getElementsByTagName(name: string): XMLElement[] { return Array.from(this.native.getElementsByTagName(name)).map((element: any) => new MobileXmlElement(element)); }
  querySelector(selector: string): XMLElement | null {
    if (selector === 'parsererror') return null;
    if (selector.startsWith('#')) return this.getElementById(selector.slice(1));
    if (/^[a-zA-Z][\w-]*$/.test(selector)) return this.getElementsByTagName(selector)[0] ?? null;
    return null;
  }
  querySelectorAll(selector: string): XMLElement[] {
    if (/^[a-zA-Z][\w-]*$/.test(selector)) return this.getElementsByTagName(selector);
    const tagAttribute = selector.match(/^(\w+)\[(\w+)\]$/);
    if (tagAttribute) return this.getElementsByTagName(tagAttribute[1]).filter((element) => element.hasAttribute(tagAttribute[2]));
    const attribute = selector.match(/^\[(?:\*\|)?(\w+)\]/);
    if (!attribute) return [];
    return this.documentElement instanceof MobileXmlElement ? this.documentElement.findAllByAttribute(attribute[1]) : [];
  }
  lookupNamespaceURI(prefix: string | null): string | null { return this.native.lookupNamespaceURI(prefix) ?? null; }
  lookupPrefix(namespace: string): string | null { return this.native.lookupPrefix(namespace) ?? null; }
  toNative(): unknown { return this.native; }
}

export class MobileDOMAdapter implements DOMAdapter {
  parseXML(value: string): XMLDocument { return new MobileXmlDocument(parseDocument(value, 'application/xml')); }
  parseHTML(value: string, _mimeType = 'text/html'): XMLDocument { return new MobileXmlDocument(parseDocument(normalizeHtmlVoidTags(value), 'text/html')); }
  serialize(document: XMLDocument): string {
    const native = document.toNative?.();
    if (!native) throw new Error('无法序列化重排文档');
    return new XMLSerializer().serializeToString(native as any);
  }
  getChildNodes(element: XMLElement): XMLNode[] {
    const native = (element as MobileXmlElement).native;
    const result: XMLNode[] = [];
    for (const child of Array.from(native.childNodes ?? []) as any[]) {
      if (child.nodeType === 1) result.push(new MobileXmlElement(child));
      else if (child.nodeType === 3) result.push({ nodeType: 3, textContent: child.textContent ?? '', parentNode: element } as XMLText);
    }
    return result;
  }
}

export class MobileURLFactory implements URLFactory {
  private counter = 0;
  private readonly urls = new Map<string, ResourceURLData>();

  createURL(data: string | ArrayBuffer | Blob, mimeType?: string): string {
    const url = `still-alive://resource-${this.counter++}`;
    const actualMimeType = typeof Blob !== 'undefined' && data instanceof Blob ? data.type || mimeType || 'application/octet-stream' : mimeType || 'application/octet-stream';
    this.urls.set(url, { data, mimeType: actualMimeType });
    return url;
  }

  revokeURL(url: string): void { this.urls.delete(url); }
  getData(url: string): ResourceURLData | undefined { return this.urls.get(url); }
  entries(): Array<[string, ResourceURLData]> { return Array.from(this.urls.entries()); }
}
