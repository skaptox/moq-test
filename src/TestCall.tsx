import { Component, createSignal, onCleanup, For, Show } from "solid-js";
import { useParams } from "@solidjs/router";
import * as Moq from "@moq/lite";
import { createAccessor } from "@moq/signals/solid";

// --- Stream Name Helpers ---

function getCountryCode(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const region = new Intl.Locale(navigator.language).region;
    if (region) return region.toLowerCase();
    const continent = tz.split("/")[0]?.toLowerCase() ?? "xx";
    return continent.slice(0, 2);
  } catch {
    return "xx";
  }
}

function getOrCreateStreamName(): string {
  const key = "moq-test-stream-name";
  const stored = localStorage.getItem(key);
  if (stored) return stored;
  const country = getCountryCode();
  const id = crypto.randomUUID().slice(0, 6);
  const name = `${country}-${id}`;
  localStorage.setItem(key, name);
  return name;
}

// --- Diagnostic Event Log ---

interface DiagEvent {
  t: number;
  tag: string;
  msg: string;
}

const T0 = performance.now();
function diagTime(): number {
  return Math.round(performance.now() - T0);
}

// --- Component ---

export const TestCall: Component = () => {
  // Diagnostic log
  const [diagLog, setDiagLog] = createSignal<DiagEvent[]>([]);
  const log = (tag: string, msg: string) => {
    setDiagLog((prev) => [{ t: diagTime(), tag, msg }, ...prev].slice(0, 50));
  };

  // Stream name state
  const params = useParams<{ streamName?: string }>();
  const urlStream = () =>
    params.streamName?.toLowerCase().replace(/[^a-z0-9-]/g, "");
  const [roomName, setRoomName] = createSignal(
    urlStream() || getOrCreateStreamName(),
  );

  const handleNameChange = (value: string) => {
    const clean = value.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setRoomName(clean);
    localStorage.setItem("moq-test-stream-name", clean);
  };

  // Connection setup
  const connection = new Moq.Connection.Reload({ enabled: false });
  const connectionStatus = createAccessor(connection.status);

  // Join / Leave
  const [joined, setJoined] = createSignal(false);
  const [joining, setJoining] = createSignal(false);

  const handleJoin = () => {
    setJoining(true);
    connection.url.set(
      new URL("https://usc.cdn.moq.dev/anon/" + roomName()),
    );
    connection.enabled.set(true);
    log("conn", "connection enabled");
    setJoined(true);
    setJoining(false);
  };

  const handleLeave = () => {
    connection.url.set(undefined);
    connection.enabled.set(false);
    setJoined(false);
    log("conn", "disconnected");
  };

  onCleanup(() => {
    connection.close();
  });

  return (
    <div class="min-h-screen bg-gray-950 text-white p-6">
      <div class="max-w-2xl mx-auto space-y-6">
        {/* Title */}
        <div>
          <h1 class="text-2xl font-bold">MoQ Interop Test</h1>
          <p class="text-gray-400 text-sm">
            Test streaming via MoQ CDN relay
          </p>
        </div>

        {/* Stream name input */}
        <div class="space-y-2">
          <label class="block text-sm font-medium text-gray-400">
            Stream Name
          </label>
          <input
            type="text"
            value={roomName()}
            onInput={(e) => handleNameChange(e.currentTarget.value)}
            class="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500"
            disabled={joined()}
          />
          <p class="text-xs text-gray-500">
            Connects via MoQ CDN (usc.cdn.moq.dev). Share this stream name
            with others to test together.
          </p>
        </div>

        {/* Join / Leave button */}
        <div class="space-y-3">
          <Show
            when={joined()}
            fallback={
              <button
                class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                onClick={handleJoin}
                disabled={joining()}
              >
                <Show when={joining()}>
                  <span class="loading loading-spinner loading-sm" />
                </Show>
                {joining() ? "Connecting..." : "Join"}
              </button>
            }
          >
            <button
              class="px-4 py-2 bg-red-600 hover:bg-red-700 rounded font-medium"
              onClick={handleLeave}
            >
              Leave
            </button>
          </Show>

          {/* Connection status badge */}
          <Show when={joined()}>
            <div class="flex items-center gap-2">
              <span
                class={`inline-block w-2 h-2 rounded-full ${
                  connectionStatus() === "connected"
                    ? "bg-green-500"
                    : "bg-yellow-500"
                }`}
              />
              <span class="text-sm text-gray-400">{connectionStatus()}</span>
            </div>
          </Show>
        </div>

        {/* Event log */}
        <div class="space-y-2">
          <h2 class="text-sm font-medium text-gray-400">Event Log</h2>
          <div class="bg-gray-900 border border-gray-700 rounded p-3 max-h-64 overflow-y-auto font-mono text-xs text-gray-400">
            <Show
              when={diagLog().length > 0}
              fallback={
                <p class="text-gray-500 italic">No events yet.</p>
              }
            >
              <For each={diagLog()}>
                {(event) => (
                  <div>
                    {event.t}ms [{event.tag}] {event.msg}
                  </div>
                )}
              </For>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
};
