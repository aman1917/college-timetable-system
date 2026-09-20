'use client';

/**
 * One component behind every master-data screen.
 *
 * Streams, teachers, subjects, rooms, slots and the rest differ only in their
 * fields, columns and endpoint — so they are described declaratively rather
 * than implemented ten times. A fix to search, validation display or delete
 * handling lands everywhere at once.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { del, get, post, put } from '@/lib/client';
import {
  ConfirmDialog,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  Spinner,
  useToast,
  type FieldDef,
} from './ui';

export interface ColumnDef<T> {
  header: string;
  render: (row: T) => React.ReactNode;
  /** Text used for client-side search of this column. */
  search?: (row: T) => string;
}

export interface ResourceConfig<T extends { id: string }> {
  title: string;
  subtitle?: string;
  endpoint: string;
  /** Singular noun for buttons and dialogs, e.g. "Teacher". */
  noun: string;
  columns: ColumnDef<T>[];
  /** Fields may depend on other loaded data (streams, rooms…). */
  fields: (ctx: { rows: T[]; values: Record<string, unknown> }) => FieldDef[];
  /** Blank form values for a new record. */
  emptyValues: () => Record<string, unknown>;
  /** Map a row to form values when editing. */
  toFormValues: (row: T) => Record<string, unknown>;
  /** Map form values to the request body. Defaults to identity. */
  toPayload?: (values: Record<string, unknown>) => unknown;
  /** Extra content rendered inside the form, below the generated fields. */
  renderExtra?: (
    values: Record<string, unknown>,
    setValue: (key: string, value: unknown) => void,
  ) => React.ReactNode;
  readOnly?: boolean;
}

export function ResourcePage<T extends { id: string }>({ config }: { config: ResourceConfig<T> }) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<{ id: string | null; values: Record<string, unknown> } | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<T | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await get<T[]>(config.endpoint));
    } catch (error) {
      toast((error as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [config.endpoint, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      config.columns.some((c) => (c.search ? c.search(row) : '').toLowerCase().includes(q)),
    );
  }, [rows, query, config.columns]);

  const setValue = (key: string, value: unknown) =>
    setEditing((e) => (e ? { ...e, values: { ...e.values, [key]: value } } : e));

  async function save() {
    if (!editing) return;
    setSaving(true);
    try {
      const payload = config.toPayload ? config.toPayload(editing.values) : editing.values;
      if (editing.id) await put(`${config.endpoint}/${editing.id}`, payload);
      else await post(config.endpoint, payload);
      toast(`${config.noun} saved.`);
      setEditing(null);
      await load();
    } catch (error) {
      toast((error as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: T) {
    try {
      await del(`${config.endpoint}/${row.id}`);
      toast(`${config.noun} deleted.`);
      setConfirmDelete(null);
      await load();
    } catch (error) {
      // Referential refusals arrive here — they explain what still points at
      // this record, which is exactly what the user needs to act on.
      toast((error as Error).message, 'error');
      setConfirmDelete(null);
    }
  }

  const fields = editing ? config.fields({ rows, values: editing.values }) : [];

  return (
    <>
      <PageHeader
        title={config.title}
        subtitle={config.subtitle ?? `${rows.length} record${rows.length === 1 ? '' : 's'}`}
        actions={
          <>
            <input
              className="field w-56"
              placeholder="Search…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {!config.readOnly && (
              <button
                className="btn-brand"
                onClick={() => setEditing({ id: null, values: config.emptyValues() })}
              >
                + Add {config.noun}
              </button>
            )}
          </>
        }
      />

      {loading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <EmptyState message={query ? 'No records match your search.' : `No ${config.noun.toLowerCase()}s yet.`} />
      ) : (
        <div className="panel overflow-x-auto">
          <table className="table-simple">
            <thead>
              <tr>
                {config.columns.map((c) => (
                  <th key={c.header}>{c.header}</th>
                ))}
                {!config.readOnly && <th />}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="hover:bg-brand/5">
                  {config.columns.map((c) => (
                    <td key={c.header}>{c.render(row)}</td>
                  ))}
                  {!config.readOnly && (
                    <td className="whitespace-nowrap text-right">
                      <button
                        className="btn-ghost btn-sm"
                        onClick={() => setEditing({ id: row.id, values: config.toFormValues(row) })}
                      >
                        Edit
                      </button>{' '}
                      <button className="btn-danger btn-sm" onClick={() => setConfirmDelete(row)}>
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <Modal
          title={`${editing.id ? 'Edit' : 'Add'} ${config.noun}`}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button className="btn-ghost" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button className="btn-brand" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : editing.id ? 'Save changes' : `Add ${config.noun}`}
              </button>
            </>
          }
        >
          <div className="grid gap-x-4 sm:grid-cols-2">
            {fields.map((f) => (
              <Field
                key={f.key}
                def={f}
                value={editing.values[f.key]}
                values={editing.values}
                onChange={setValue}
              />
            ))}
          </div>
          {config.renderExtra?.(editing.values, setValue)}
        </Modal>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title={`Delete ${config.noun}?`}
          message="This cannot be undone. If other records still reference it, the deletion will be refused and nothing will change."
          confirmLabel="Delete"
          danger
          onConfirm={() => remove(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </>
  );
}
