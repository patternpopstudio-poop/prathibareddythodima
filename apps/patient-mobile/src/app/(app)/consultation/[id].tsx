import {
  MESSAGE_BODY_MAX_LENGTH,
  OFFLINE_CHAT_UNAVAILABLE_COPY,
  appendMessageIfNew,
  isChatEnabledForMode,
  isImageAttachmentMime,
  messageReceiptLabel,
  upsertMessageById,
  type Message,
} from '@teleconsult/shared-types';
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Screen } from '@/components/ui/screen';
import { ScreenNav } from '@/components/ui/screen-nav';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import {
  consultationStatusLabel,
  createConsultationAttachmentSignedUrl,
  fetchConsultationMessages,
  fetchPatientConsultationById,
  markConsultationMessagesRead,
  sendPatientAttachment,
  sendPatientMessage,
  subscribeConsultationThread,
  type PatientConsultationCase,
} from '@/lib/consultations';
import { supabase } from '@/lib/supabase';

function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function MessageAttachmentView({
  message,
  mine,
}: {
  message: Message;
  mine: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const ensureUrl = useCallback(async () => {
    if (!message.attachmentPath) return null;
    if (url) return url;
    setLoading(true);
    setErr(null);
    try {
      const signed = await createConsultationAttachmentSignedUrl(message.attachmentPath);
      setUrl(signed);
      return signed;
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not open file.');
      return null;
    } finally {
      setLoading(false);
    }
  }, [message.attachmentPath, url]);

  useEffect(() => {
    if (isImageAttachmentMime(message.attachmentMime)) {
      void ensureUrl();
    }
  }, [ensureUrl, message.attachmentMime]);

  async function onOpen() {
    const signed = await ensureUrl();
    if (!signed) return;
    await WebBrowser.openBrowserAsync(signed);
  }

  if (!message.attachmentPath || !message.attachmentName) return null;

  const isImage = isImageAttachmentMime(message.attachmentMime);

  return (
    <View style={styles.attachmentBlock}>
      {isImage && url ? (
        <Pressable onPress={() => void onOpen()}>
          <Image source={{ uri: url }} style={styles.attachmentImage} contentFit="cover" />
        </Pressable>
      ) : null}
      <Pressable
        onPress={() => void onOpen()}
        disabled={loading}
        style={({ pressed }) => [
          styles.attachmentChip,
          mine ? styles.attachmentChipMine : styles.attachmentChipOther,
          pressed && styles.pressed,
        ]}>
        <AppText
          variant="bodyMedium"
          style={[styles.attachmentName, mine ? styles.bubbleTextMine : null]}
          numberOfLines={2}>
          {loading ? 'Opening…' : message.attachmentName}
        </AppText>
      </Pressable>
      {err ? (
        <AppText variant="muted" style={[styles.attachErr, mine ? styles.bubbleMetaMine : null]}>
          {err}
        </AppText>
      ) : null}
    </View>
  );
}

export default function ConsultationThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [caseRow, setCaseRow] = useState<PatientConsultationCase | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [live, setLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<Message>>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const row = await fetchPatientConsultationById(id);
      if (!row) {
        setCaseRow(null);
        setMessages([]);
        setError('Consultation not found.');
        return;
      }
      setCaseRow(row);
      if (isChatEnabledForMode(row.consultation.mode)) {
        setMessages(await fetchConsultationMessages(id));
        void markConsultationMessagesRead(id).catch(() => {});
      } else {
        setMessages([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load chat.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;

      void load();
      setLive(false);

      let channel: ReturnType<typeof subscribeConsultationThread> | null = null;
      let cancelled = false;

      void (async () => {
        try {
          const row = await fetchPatientConsultationById(id);
          if (cancelled || !row || !isChatEnabledForMode(row.consultation.mode)) {
            return;
          }

          void markConsultationMessagesRead(id).catch(() => {});

          channel = subscribeConsultationThread(id, {
            onMessage: (message) => {
              setMessages((prev) => appendMessageIfNew(prev, message));
              setCaseRow((prev) =>
                prev
                  ? {
                      ...prev,
                      consultation: {
                        ...prev.consultation,
                        lastMessageAt: message.createdAt,
                        status:
                          message.senderRole === 'doctor'
                            ? 'in_progress'
                            : prev.consultation.status,
                      },
                    }
                  : prev
              );
              if (message.senderRole === 'doctor') {
                void markConsultationMessagesRead(id).catch(() => {});
              }
            },
            onMessageUpdate: (message) => {
              setMessages((prev) => upsertMessageById(prev, message));
            },
            onConsultation: (consultation) => {
              setCaseRow((prev) =>
                prev
                  ? {
                      ...prev,
                      consultation: {
                        ...prev.consultation,
                        ...consultation,
                      },
                    }
                  : prev
              );
            },
          });
          channel.subscribe((status) => {
            setLive(status === 'SUBSCRIBED');
          });
        } catch {
          // load() already surfaces errors
        }
      })();

      return () => {
        cancelled = true;
        setLive(false);
        if (channel) void supabase.removeChannel(channel);
      };
    }, [id, load])
  );

  async function onSend() {
    if (!id || sending) return;
    const text = draft.trim();
    if (!text) return;

    setSending(true);
    setError(null);
    try {
      const sent = await sendPatientMessage(id, text);
      setDraft('');
      setMessages((prev) => appendMessageIfNew(prev, sent));
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send message.');
    } finally {
      setSending(false);
    }
  }

  async function onAttach() {
    if (!id || sending) return;

    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setSending(true);
    setError(null);
    try {
      const sent = await sendPatientAttachment(
        id,
        {
          uri: asset.uri,
          name: asset.name,
          mimeType: asset.mimeType,
          size: asset.size,
        },
        draft
      );
      setDraft('');
      setMessages((prev) => appendMessageIfNew(prev, sent));
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send file.');
    } finally {
      setSending(false);
    }
  }

  const title = caseRow?.doctor.fullName?.trim() || 'Consultation';
  const chatEnabled = caseRow
    ? isChatEnabledForMode(caseRow.consultation.mode)
    : false;

  return (
    <Screen scroll={false} padded={false}>
      <View style={styles.shell}>
        <View style={styles.header}>
          <ScreenNav title={title} />
          {caseRow ? (
            <View style={styles.statusRow}>
              <AppText variant="muted" style={styles.status}>
                {consultationStatusLabel(caseRow.consultation.status)}
                {chatEnabled && live ? ' · Live' : ''}
              </AppText>
              {chatEnabled ? (
                <Pressable onPress={() => void load()} hitSlop={8}>
                  <AppText variant="bodyMedium" style={styles.reloadText}>
                    Reload
                  </AppText>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={Colors.primary900} />
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <AppText variant="muted" style={styles.errorText}>
              {error}
            </AppText>
          </View>
        ) : null}

        {!loading && caseRow && !chatEnabled ? (
          <View style={styles.offlineGate}>
            <AppText variant="h3" style={styles.offlineTitle}>
              {OFFLINE_CHAT_UNAVAILABLE_COPY}
            </AppText>
            <AppText variant="muted" style={styles.offlineBody}>
              This is an in-clinic appointment. Messaging opens only for online
              consultations.
            </AppText>
          </View>
        ) : null}

        {!loading && caseRow && chatEnabled ? (
          <>
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.thread}
              onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
              ListEmptyComponent={
                <AppText variant="muted" style={styles.emptyThread}>
                  No messages yet. Introduce yourself to start the consultation.
                </AppText>
              }
              renderItem={({ item }) => {
                const mine = item.senderId === userId || item.senderRole === 'patient';
                const body = item.body?.trim();
                return (
                  <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : null]}>
                    <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                      {item.attachmentPath ? (
                        <MessageAttachmentView message={item} mine={mine} />
                      ) : null}
                      {body ? (
                        <AppText
                          variant="body"
                          style={[styles.bubbleText, mine ? styles.bubbleTextMine : null]}>
                          {body}
                        </AppText>
                      ) : null}
                      <AppText
                        variant="muted"
                        style={[styles.bubbleMeta, mine ? styles.bubbleMetaMine : null]}>
                        {formatMessageTime(item.createdAt)}
                        {mine ? ` · ${messageReceiptLabel(item)}` : ''}
                      </AppText>
                    </View>
                  </View>
                );
              }}
            />

            <View style={styles.composer}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Attach file"
                disabled={sending}
                onPress={() => void onAttach()}
                style={({ pressed }) => [
                  styles.attachBtn,
                  sending && styles.sendDisabled,
                  pressed && styles.pressed,
                ]}>
                <AppText variant="label" style={styles.attachLabel}>
                  File
                </AppText>
              </Pressable>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Write a message…"
                placeholderTextColor={Colors.placeholder}
                multiline
                maxLength={MESSAGE_BODY_MAX_LENGTH}
                editable={!sending}
                style={styles.input}
              />
              <Pressable
                accessibilityRole="button"
                disabled={sending || !draft.trim()}
                onPress={() => void onSend()}
                style={({ pressed }) => [
                  styles.sendBtn,
                  (sending || !draft.trim()) && styles.sendDisabled,
                  pressed && styles.pressed,
                ]}>
                <AppText variant="label" style={styles.sendLabel}>
                  {sending ? '…' : 'Send'}
                </AppText>
              </Pressable>
            </View>
          </>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  header: {
    gap: Spacing.xs,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingBottom: Spacing.xs,
  },
  status: {
    fontSize: 12,
  },
  reloadText: {
    color: Colors.primary900,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBox: {
    padding: Spacing.md,
    borderRadius: Radius.card,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  errorText: {
    color: Colors.accentRed,
  },
  thread: {
    flexGrow: 1,
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  emptyThread: {
    textAlign: 'center',
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.md,
  },
  offlineGate: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  offlineTitle: {
    textAlign: 'center',
  },
  offlineBody: {
    textAlign: 'center',
  },
  bubbleRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  bubbleRowMine: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 18,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: 4,
  },
  bubbleOther: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomLeftRadius: 6,
  },
  bubbleMine: {
    backgroundColor: Colors.primary900,
    borderBottomRightRadius: 6,
  },
  bubbleText: {
    color: Colors.text,
  },
  bubbleTextMine: {
    color: Colors.white,
  },
  bubbleMeta: {
    fontSize: 11,
  },
  bubbleMetaMine: {
    color: Colors.primary100,
  },
  attachmentBlock: {
    gap: 6,
  },
  attachmentImage: {
    width: 220,
    height: 160,
    borderRadius: 12,
    backgroundColor: Colors.gray100,
  },
  attachmentChip: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  attachmentChipMine: {
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  attachmentChipOther: {
    backgroundColor: Colors.primary50,
  },
  attachmentName: {
    fontSize: 14,
  },
  attachErr: {
    fontSize: 11,
    color: Colors.accentRed,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  attachBtn: {
    height: 44,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Colors.gray200,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  attachLabel: {
    color: Colors.primary900,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: Radius.input,
    borderWidth: 1,
    borderColor: Colors.gray200,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontFamily: FontFamily.body,
    fontSize: 16,
    color: Colors.text,
  },
  sendBtn: {
    minWidth: 72,
    height: 44,
    borderRadius: Radius.button,
    backgroundColor: Colors.primary900,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  sendDisabled: {
    opacity: 0.45,
  },
  sendLabel: {
    color: Colors.white,
  },
  pressed: {
    opacity: 0.9,
  },
});
