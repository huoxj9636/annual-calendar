"use client";

/* reading-room.tsx — 书房：书单管理 + 图书卡片网格 */

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  X,
  ExternalLink,
  BookOpen,
  Loader2,
  Trash2,
  Pencil,
  Check,
  GripVertical,
} from "lucide-react";
import type { SkinTheme } from "@/lib/skins";

// === 类型 ===

interface BookList {
  id: string;
  name: string;
  createdAt: number;
  bookCount: number;
}

interface Book {
  id: string;
  title: string;
  author: string;
  coverUrl: string;
  wereadUrl: string;
  status: "want" | "reading" | "done";
  bookListId: string | null;
  createdAt: number;
}

type ReadingStatus = "want" | "reading" | "done";

const STATUS_CONFIG: Record<ReadingStatus, { label: string; color: string }> = {
  want: { label: "想读", color: "#8B9DAF" },
  reading: { label: "在读", color: "#5B8C5A" },
  done: { label: "已读", color: "#B8860B" },
};

interface ReadingRoomProps {
  skin: SkinTheme;
}

export default function ReadingRoom({ skin }: ReadingRoomProps) {
  const [bookLists, setBookLists] = useState<BookList[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [activeListId, setActiveListId] = useState<string | null>(null); // null = 全部
  const [loading, setLoading] = useState(true);

  // 弹窗
  const [showAddBook, setShowAddBook] = useState(false);
  const [showAddList, setShowAddList] = useState(false);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingListName, setEditingListName] = useState("");
  const [pendingDeleteBookId, setPendingDeleteBookId] = useState<string | null>(null);
  const [pendingDeleteListId, setPendingDeleteListId] = useState<string | null>(null);

  // 添加书表单
  const [newBook, setNewBook] = useState({
    title: "",
    author: "",
    coverUrl: "",
    wereadUrl: "",
    status: "want" as ReadingStatus,
    bookListId: "" as string,
  });
  const [parsing, setParsing] = useState(false);
  const [newListName, setNewListName] = useState("");

  // 加载数据
  const loadData = useCallback(async () => {
    try {
      const [listsRes, booksRes] = await Promise.all([
        fetch("/api/book-lists"),
        fetch("/api/books" + (activeListId ? `?list_id=${activeListId}` : "")),
      ]);
      if (listsRes.ok) {
        const lists = await listsRes.json();
        setBookLists(Array.isArray(lists) ? lists : []);
      }
      if (booksRes.ok) {
        const bks = await booksRes.json();
        setBooks(Array.isArray(bks) ? bks : []);
      }
    } catch (e) {
      console.error("加载书房数据失败", e);
    } finally {
      setLoading(false);
    }
  }, [activeListId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // === 书单操作 ===

  const createList = async () => {
    if (!newListName.trim()) return;
    const res = await fetch("/api/book-lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newListName.trim() }),
    });
    if (res.ok) {
      setNewListName("");
      setShowAddList(false);
      await loadData();
    }
  };

  const renameList = async (id: string) => {
    if (!editingListName.trim()) return;
    await fetch("/api/book-lists", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name: editingListName.trim() }),
    });
    setEditingListId(null);
    setEditingListName("");
    await loadData();
  };

  const deleteList = async (id: string) => {
    await fetch(`/api/book-lists?id=${id}`, { method: "DELETE" });
    if (activeListId === id) setActiveListId(null);
    setPendingDeleteListId(null);
    await loadData();
  };

  // === 书籍操作 ===

  const addBook = async () => {
    if (!newBook.title.trim()) return;
    const res = await fetch("/api/books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...newBook,
        bookListId: newBook.bookListId || activeListId || null,
      }),
    });
    if (res.ok) {
      setNewBook({ title: "", author: "", coverUrl: "", wereadUrl: "", status: "want", bookListId: "" });
      setShowAddBook(false);
      await loadData();
    }
  };

  const updateBookStatus = async (id: string, status: ReadingStatus) => {
    await fetch("/api/books", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    await loadData();
  };

  const deleteBook = async (id: string) => {
    await fetch(`/api/books?id=${id}`, { method: "DELETE" });
    setPendingDeleteBookId(null);
    await loadData();
  };

  // === 微信读书解析 ===

  const parseWeRead = async () => {
    const url = newBook.wereadUrl.trim();
    if (!url) return;
    setParsing(true);
    try {
      const res = await fetch("/api/parse-weread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (res.ok) {
        const data = await res.json();
        setNewBook((prev) => ({
          ...prev,
          title: data.title || prev.title,
          author: data.author || prev.author,
          coverUrl: data.coverUrl || prev.coverUrl,
        }));
      }
    } catch (e) {
      console.error("解析失败", e);
    } finally {
      setParsing(false);
    }
  };

  // === 统计 ===
  const stats = {
    total: books.length,
    reading: books.filter((b) => b.status === "reading").length,
    done: books.filter((b) => b.status === "done").length,
    want: books.filter((b) => b.status === "want").length,
  };

  // === 按状态分组 ===
  const groupedBooks = {
    reading: books.filter((b) => b.status === "reading"),
    want: books.filter((b) => b.status === "want"),
    done: books.filter((b) => b.status === "done"),
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin" style={{ color: skin.textMuted }} />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* 统计条 */}
      <div
        className="flex items-center gap-4 px-6 py-3 border-b"
        style={{ borderColor: skin.divider }}
      >
        <StatBadge label="总计" value={stats.total} skin={skin} />
        <StatBadge label="在读" value={stats.reading} skin={skin} accent="#5B8C5A" />
        <StatBadge label="想读" value={stats.want} skin={skin} accent="#8B9DAF" />
        <StatBadge label="已读" value={stats.done} skin={skin} accent="#B8860B" />
      </div>

      {/* 书单标签栏 */}
      <div
        className="flex items-center gap-2 px-6 py-3 overflow-x-auto border-b"
        style={{ borderColor: skin.divider }}
      >
        <ListTab
          label="全部"
          active={activeListId === null}
          onClick={() => setActiveListId(null)}
          skin={skin}
        />
        {bookLists.map((list) => (
          <ListTab
            key={list.id}
            label={`${list.name} (${list.bookCount})`}
            active={activeListId === list.id}
            onClick={() => setActiveListId(list.id)}
            skin={skin}
            onEdit={() => {
              setEditingListId(list.id);
              setEditingListName(list.name);
            }}
            onDelete={() => setPendingDeleteListId(list.id)}
            isEditing={editingListId === list.id}
            editValue={editingListName}
            onEditChange={setEditingListName}
            onEditConfirm={() => renameList(list.id)}
            onEditCancel={() => {
              setEditingListId(null);
              setEditingListName("");
            }}
          />
        ))}
        <button
          onClick={() => setShowAddList(true)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs transition-all whitespace-nowrap"
          style={{
            color: skin.textMuted,
            border: `1px dashed ${skin.divider}`,
          }}
        >
          <Plus size={12} />
          新建书单
        </button>
      </div>

      {/* 书籍网格 */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {books.length === 0 ? (
          <EmptyState skin={skin} onAdd={() => setShowAddBook(true)} />
        ) : (
          <div className="space-y-6">
            {/* 在读 */}
            {groupedBooks.reading.length > 0 && (
              <BookGroup
                title="在读"
                books={groupedBooks.reading}
                skin={skin}
                onStatusChange={updateBookStatus}
                onDelete={(id) => setPendingDeleteBookId(id)}
              />
            )}
            {/* 想读 */}
            {groupedBooks.want.length > 0 && (
              <BookGroup
                title="想读"
                books={groupedBooks.want}
                skin={skin}
                onStatusChange={updateBookStatus}
                onDelete={(id) => setPendingDeleteBookId(id)}
              />
            )}
            {/* 已读 */}
            {groupedBooks.done.length > 0 && (
              <BookGroup
                title="已读"
                books={groupedBooks.done}
                skin={skin}
                onStatusChange={updateBookStatus}
                onDelete={(id) => setPendingDeleteBookId(id)}
              />
            )}
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => {
          setNewBook((prev) => ({
            ...prev,
            bookListId: activeListId || "",
          }));
          setShowAddBook(true);
        }}
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-105"
        style={{
          background: skin.swatch,
          color: "#fff",
          boxShadow: `0 6px 20px ${skin.swatch}66`,
        }}
      >
        <Plus size={24} />
      </button>

      {/* === 弹窗们 === */}

      {/* 添加书籍弹窗 */}
      {showAddBook && (
        <Modal skin={skin} onClose={() => setShowAddBook(false)}>
          <ModalTitle title="添加书籍" skin={skin} />
          <div className="space-y-3 mt-4">
            {/* 微信读书链接 + 解析按钮 */}
            <div>
              <label className="text-xs mb-1 block" style={{ color: skin.textMuted }}>
                微信读书链接
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="粘贴微信读书链接自动解析..."
                  value={newBook.wereadUrl}
                  onChange={(e) =>
                    setNewBook((prev) => ({ ...prev, wereadUrl: e.target.value }))
                  }
                  className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                  style={{
                    background: skin.panelBg,
                    color: skin.textPrimary,
                    border: `1px solid ${skin.divider}`,
                  }}
                />
                <button
                  onClick={parseWeRead}
                  disabled={parsing || !newBook.wereadUrl.trim()}
                  className="px-3 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-40"
                  style={{
                    background: skin.swatch,
                    color: "#fff",
                  }}
                >
                  {parsing ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    "解析"
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs mb-1 block" style={{ color: skin.textMuted }}>
                书名 *
              </label>
              <input
                type="text"
                placeholder="书名"
                value={newBook.title}
                onChange={(e) =>
                  setNewBook((prev) => ({ ...prev, title: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{
                  background: skin.panelBg,
                  color: skin.textPrimary,
                  border: `1px solid ${skin.divider}`,
                }}
              />
            </div>

            <div>
              <label className="text-xs mb-1 block" style={{ color: skin.textMuted }}>
                作者
              </label>
              <input
                type="text"
                placeholder="作者"
                value={newBook.author}
                onChange={(e) =>
                  setNewBook((prev) => ({ ...prev, author: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{
                  background: skin.panelBg,
                  color: skin.textPrimary,
                  border: `1px solid ${skin.divider}`,
                }}
              />
            </div>

            <div>
              <label className="text-xs mb-1 block" style={{ color: skin.textMuted }}>
                封面图 URL
              </label>
              <input
                type="text"
                placeholder="封面图片链接（选填）"
                value={newBook.coverUrl}
                onChange={(e) =>
                  setNewBook((prev) => ({ ...prev, coverUrl: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{
                  background: skin.panelBg,
                  color: skin.textPrimary,
                  border: `1px solid ${skin.divider}`,
                }}
              />
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs mb-1 block" style={{ color: skin.textMuted }}>
                  阅读状态
                </label>
                <select
                  value={newBook.status}
                  onChange={(e) =>
                    setNewBook((prev) => ({
                      ...prev,
                      status: e.target.value as ReadingStatus,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{
                    background: skin.panelBg,
                    color: skin.textPrimary,
                    border: `1px solid ${skin.divider}`,
                  }}
                >
                  <option value="want">想读</option>
                  <option value="reading">在读</option>
                  <option value="done">已读</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="text-xs mb-1 block" style={{ color: skin.textMuted }}>
                  所属书单
                </label>
                <select
                  value={newBook.bookListId}
                  onChange={(e) =>
                    setNewBook((prev) => ({ ...prev, bookListId: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{
                    background: skin.panelBg,
                    color: skin.textPrimary,
                    border: `1px solid ${skin.divider}`,
                  }}
                >
                  <option value="">未分类</option>
                  {bookLists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-5">
            <Btn variant="ghost" skin={skin} onClick={() => setShowAddBook(false)}>
              取消
            </Btn>
            <Btn variant="primary" skin={skin} onClick={addBook} disabled={!newBook.title.trim()}>
              添加
            </Btn>
          </div>
        </Modal>
      )}

      {/* 新建书单弹窗 */}
      {showAddList && (
        <Modal skin={skin} onClose={() => setShowAddList(false)}>
          <ModalTitle title="新建书单" skin={skin} />
          <div className="mt-4">
            <input
              type="text"
              placeholder="书单名称"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createList()}
              autoFocus
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{
                background: skin.panelBg,
                color: skin.textPrimary,
                border: `1px solid ${skin.divider}`,
              }}
            />
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <Btn variant="ghost" skin={skin} onClick={() => setShowAddList(false)}>
              取消
            </Btn>
            <Btn variant="primary" skin={skin} onClick={createList} disabled={!newListName.trim()}>
              创建
            </Btn>
          </div>
        </Modal>
      )}

      {/* 删除书籍确认 */}
      {pendingDeleteBookId && (
        <Modal skin={skin} onClose={() => setPendingDeleteBookId(null)}>
          <ModalTitle title="确认删除" skin={skin} />
          <p className="mt-3 text-sm" style={{ color: skin.textSecondary }}>
            确定要删除这本书吗？
          </p>
          <div className="flex justify-end gap-2 mt-5">
            <Btn variant="ghost" skin={skin} onClick={() => setPendingDeleteBookId(null)}>
              取消
            </Btn>
            <Btn variant="danger" skin={skin} onClick={() => deleteBook(pendingDeleteBookId)}>
              删除
            </Btn>
          </div>
        </Modal>
      )}

      {/* 删除书单确认 */}
      {pendingDeleteListId && (
        <Modal skin={skin} onClose={() => setPendingDeleteListId(null)}>
          <ModalTitle title="删除书单" skin={skin} />
          <p className="mt-3 text-sm" style={{ color: skin.textSecondary }}>
            删除书单会同时删除其中的所有书籍，确定吗？
          </p>
          <div className="flex justify-end gap-2 mt-5">
            <Btn variant="ghost" skin={skin} onClick={() => setPendingDeleteListId(null)}>
              取消
            </Btn>
            <Btn variant="danger" skin={skin} onClick={() => deleteList(pendingDeleteListId)}>
              删除
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// === 子组件 ===

function StatBadge({
  label,
  value,
  skin,
  accent,
}: {
  label: string;
  value: number;
  skin: SkinTheme;
  accent?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="text-lg font-semibold font-mono tabular-nums"
        style={{ color: accent || skin.textPrimary }}
      >
        {value}
      </span>
      <span className="text-[11px]" style={{ color: skin.textMuted }}>
        {label}
      </span>
    </div>
  );
}

function ListTab({
  label,
  active,
  onClick,
  skin,
  onEdit,
  onDelete,
  isEditing,
  editValue,
  onEditChange,
  onEditConfirm,
  onEditCancel,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  skin: SkinTheme;
  onEdit?: () => void;
  onDelete?: () => void;
  isEditing?: boolean;
  editValue?: string;
  onEditChange?: (v: string) => void;
  onEditConfirm?: () => void;
  onEditCancel?: () => void;
}) {
  if (isEditing && onEditChange && onEditConfirm && onEditCancel) {
    return (
      <div className="flex items-center gap-1 px-2 py-1 rounded-full" style={{ background: skin.swatch + "18" }}>
        <input
          type="text"
          value={editValue}
          onChange={(e) => onEditChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onEditConfirm();
            if (e.key === "Escape") onEditCancel();
          }}
          autoFocus
          className="w-20 px-1 py-0 text-xs bg-transparent outline-none"
          style={{ color: skin.textPrimary }}
        />
        <button onClick={onEditConfirm}>
          <Check size={12} style={{ color: skin.swatch }} />
        </button>
        <button onClick={onEditCancel}>
          <X size={12} style={{ color: skin.textMuted }} />
        </button>
      </div>
    );
  }

  return (
    <div
      className="group flex items-center gap-1 px-3 py-1.5 rounded-full text-xs transition-all cursor-pointer whitespace-nowrap"
      style={{
        background: active ? skin.swatch + "20" : "transparent",
        color: active ? skin.swatch : skin.textMuted,
        border: `1px solid ${active ? skin.swatch + "40" : skin.divider}`,
      }}
      onClick={onClick}
    >
      <span>{label}</span>
      {onEdit && (
        <span className="hidden group-hover:inline-flex items-center gap-0.5 ml-1">
          <Pencil
            size={10}
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          />
          <Trash2
            size={10}
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.();
            }}
          />
        </span>
      )}
    </div>
  );
}

function BookGroup({
  title,
  books,
  skin,
  onStatusChange,
  onDelete,
}: {
  title: string;
  books: Book[];
  skin: SkinTheme;
  onStatusChange: (id: string, status: ReadingStatus) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div>
      <h3
        className="text-xs font-medium mb-3 tracking-widest uppercase"
        style={{ color: skin.textMuted }}
      >
        {title} · {books.length}
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {books.map((book) => (
          <BookCard
            key={book.id}
            book={book}
            skin={skin}
            onStatusChange={onStatusChange}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}

function BookCard({
  book,
  skin,
  onStatusChange,
  onDelete,
}: {
  book: Book;
  skin: SkinTheme;
  onStatusChange: (id: string, status: ReadingStatus) => void;
  onDelete: (id: string) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const statusConf = STATUS_CONFIG[book.status];

  // 下一个状态循环
  const nextStatus: Record<ReadingStatus, ReadingStatus> = {
    want: "reading",
    reading: "done",
    done: "want",
  };

  return (
    <div
      className="group relative rounded-xl overflow-hidden transition-all hover:-translate-y-0.5"
      style={{
        background: skin.cardBg,
        border: `1px solid ${skin.divider}`,
        boxShadow: `0 2px 8px ${skin.swatch}08`,
      }}
    >
      {/* 封面区域 */}
      <div
        className="relative aspect-[3/4] overflow-hidden"
        style={{ background: skin.swatch + "08" }}
      >
        {book.coverUrl ? (
          <img
            src={book.coverUrl}
            alt={book.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${skin.swatch}15, ${skin.swatch}08)`,
            }}
          >
            <BookOpen size={32} style={{ color: skin.swatch + "40" }} />
          </div>
        )}

        {/* 状态标签 */}
        <span
          className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-medium"
          style={{
            background: statusConf.color + "22",
            color: statusConf.color,
            border: `1px solid ${statusConf.color}33`,
          }}
        >
          {statusConf.label}
        </span>

        {/* 悬停操作 */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
          {book.wereadUrl && (
            <a
              href={book.wereadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center transition-transform hover:scale-110"
              title="去微信读书阅读"
            >
              <ExternalLink size={16} className="text-gray-700" />
            </a>
          )}
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center transition-transform hover:scale-110"
          >
            <GripVertical size={16} className="text-gray-700" />
          </button>
        </div>
      </div>

      {/* 信息区 */}
      <div className="p-3">
        <h4
          className="text-sm font-medium leading-tight line-clamp-2"
          style={{
            color: skin.textPrimary,
            fontFamily: "var(--font-serif)",
          }}
        >
          {book.title}
        </h4>
        {book.author && (
          <p
            className="text-[11px] mt-1 truncate"
            style={{ color: skin.textMuted }}
          >
            {book.author}
          </p>
        )}
      </div>

      {/* 弹出菜单 */}
      {showMenu && (
        <div
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg py-1 shadow-lg z-10"
          style={{
            background: skin.cardBg,
            border: `1px solid ${skin.divider}`,
          }}
        >
          <MenuBtn
            label="切换状态"
            sublabel={`→ ${STATUS_CONFIG[nextStatus[book.status]].label}`}
            skin={skin}
            onClick={() => {
              onStatusChange(book.id, nextStatus[book.status]);
              setShowMenu(false);
            }}
          />
          <MenuBtn
            label="删除"
            skin={skin}
            danger
            onClick={() => {
              onDelete(book.id);
              setShowMenu(false);
            }}
          />
          <div
            className="mx-2 my-1 border-t"
            style={{ borderColor: skin.divider }}
          />
          <MenuBtn
            label="关闭"
            skin={skin}
            onClick={() => setShowMenu(false)}
          />
        </div>
      )}
    </div>
  );
}

function MenuBtn({
  label,
  sublabel,
  skin,
  onClick,
  danger,
}: {
  label: string;
  sublabel?: string;
  skin: SkinTheme;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full px-3 py-1.5 text-left text-xs transition-colors"
      style={{ color: danger ? "#c0392b" : skin.textPrimary }}
      onMouseEnter={(e) => {
        (e.target as HTMLElement).style.background = skin.swatch + "10";
      }}
      onMouseLeave={(e) => {
        (e.target as HTMLElement).style.background = "transparent";
      }}
    >
      {label}
      {sublabel && (
        <span className="ml-1" style={{ color: skin.textMuted }}>
          {sublabel}
        </span>
      )}
    </button>
  );
}

function EmptyState({ skin, onAdd }: { skin: SkinTheme; onAdd: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center py-20">
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
        style={{ background: skin.swatch + "10" }}
      >
        <BookOpen size={36} style={{ color: skin.swatch + "60" }} />
      </div>
      <p
        className="text-sm mb-1"
        style={{ color: skin.textSecondary, fontFamily: "var(--font-serif)" }}
      >
        书房空空如也
      </p>
      <p className="text-xs mb-4" style={{ color: skin.textMuted }}>
        添加你的第一本书吧
      </p>
      <button
        onClick={onAdd}
        className="px-4 py-2 rounded-full text-sm font-medium transition-all hover:scale-105"
        style={{
          background: skin.swatch,
          color: "#fff",
        }}
      >
        添加书籍
      </button>
    </div>
  );
}

// === 通用小组件 ===

function Modal({
  skin,
  onClose,
  children,
}: {
  skin: SkinTheme;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
        style={{
          background: skin.cardBg,
          border: `1px solid ${skin.divider}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function ModalTitle({ title, skin }: { title: string; skin: SkinTheme }) {
  return (
    <h3
      className="text-base font-semibold"
      style={{
        color: skin.textPrimary,
        fontFamily: "var(--font-serif)",
      }}
    >
      {title}
    </h3>
  );
}

function Btn({
  variant,
  skin,
  onClick,
  disabled,
  children,
}: {
  variant: "primary" | "ghost" | "danger";
  skin: SkinTheme;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const styles = {
    primary: {
      background: skin.swatch,
      color: "#fff",
      border: "none",
    },
    ghost: {
      background: "transparent",
      color: skin.textSecondary,
      border: `1px solid ${skin.divider}`,
    },
    danger: {
      background: "#c0392b",
      color: "#fff",
      border: "none",
    },
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40"
      style={styles[variant]}
    >
      {children}
    </button>
  );
}
