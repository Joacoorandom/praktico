#include <LiquidCrystal.h>
#include <WiFiS3.h>
#include <EEPROM.h>

struct ButtonState; // forward declaration for Arduino auto-prototypes

// ------------------ Hardware ------------------
LiquidCrystal lcd(7, 6, 5, 4, 3, 2);

const int BTN_NEXT = 0;   // Boton 1 (desliza)
const int BTN_OK   = 13;  // Boton 2 (ejecuta)
const int SPK_PIN  = 1;   // Speaker

// ------------------ Config persistente ------------------
const uint32_t CFG_MAGIC = 0xC0DEF00D;

struct DeviceConfig {
  uint32_t magic;
  uint16_t crc;
  char ssid[33];
  char pass[65];
  char apiHost[64];
  char apiPath[96];
  char apiKey[64];
  uint16_t beepHz;
  uint16_t beepMs;
};

DeviceConfig cfg;

uint16_t calcCrc(const DeviceConfig& c) {
  uint16_t sum = 0;
  const uint8_t* p = (const uint8_t*)&c.ssid[0];
  const size_t strSize = sizeof(c.ssid) + sizeof(c.pass) + sizeof(c.apiHost) + sizeof(c.apiPath) + sizeof(c.apiKey);
  for (size_t i = 0; i < strSize; i++) sum += p[i];
  sum += (uint8_t)(c.beepHz & 0xFF);
  sum += (uint8_t)((c.beepHz >> 8) & 0xFF);
  sum += (uint8_t)(c.beepMs & 0xFF);
  sum += (uint8_t)((c.beepMs >> 8) & 0xFF);
  return sum;
}

void setDefaults() {
  strcpy(cfg.ssid, "Ana");
  strcpy(cfg.pass, "anita2711");
  strcpy(cfg.apiHost, "praktico.vercel.app");
  strcpy(cfg.apiPath, "/api/orders?compact=1&limit=1");
  strcpy(cfg.apiKey, "");
  cfg.beepHz = 100;
  cfg.beepMs = 120;
}

void loadConfig() {
  EEPROM.get(0, cfg);
  if (cfg.magic != CFG_MAGIC || cfg.crc != calcCrc(cfg)) {
    cfg.magic = CFG_MAGIC;
    setDefaults();
    cfg.crc = calcCrc(cfg);
    EEPROM.put(0, cfg);
  }
}

void saveConfig() {
  cfg.magic = CFG_MAGIC;
  cfg.crc = calcCrc(cfg);
  EEPROM.put(0, cfg);
}

// ------------------ WiFi ------------------
WiFiServer server(80);
bool wifiReady = false;

void connectWiFi() {
  WiFi.begin(cfg.ssid, cfg.pass);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
    if (millis() - start > 15000) break;
  }
  wifiReady = (WiFi.status() == WL_CONNECTED);
  if (wifiReady) server.begin();
}

String wifiStatusText() {
  int st = WiFi.status();
  if (st == WL_CONNECTED) return "Conectado";
  if (st == WL_DISCONNECTED) return "Desconectado";
  if (st == WL_IDLE_STATUS) return "Idle";
  if (st == WL_CONNECTION_LOST) return "Perdida";
  return "Desconocido";
}

// ------------------ UI / Menu ------------------
enum ScreenMode { MAIN_MENU, SUBMENU };
ScreenMode mode = MAIN_MENU;

const char* mainItems[] = {"Estado", "WiFi", "Pedidos", "Config", "Info"};
const int mainCount = sizeof(mainItems) / sizeof(mainItems[0]);
int mainIndex = 0;
int subIndex = 0;

const char* subEstado[] = {"Test buzzer", "LCD OK", "WiFi OK", "Volver"};
const char* subWiFi[]   = {"Estado", "IP", "RSSI", "Reconnect", "Volver"};
const char* subPedidos[] = {"Ultimo", "API host", "Volver"};
const char* subConfig[] = {"Beep Hz", "Beep Ms", "Guardar", "Volver"};
const char* subInfo[]   = {"Version", "Uptime", "Volver"};

int getSubCount() {
  switch (mainIndex) {
    case 0: return sizeof(subEstado) / sizeof(subEstado[0]);
    case 1: return sizeof(subWiFi) / sizeof(subWiFi[0]);
    case 2: return sizeof(subPedidos) / sizeof(subPedidos[0]);
    case 3: return sizeof(subConfig) / sizeof(subConfig[0]);
    case 4: return sizeof(subInfo) / sizeof(subInfo[0]);
  }
  return 0;
}

const char* getSubItem(int idx) {
  switch (mainIndex) {
    case 0: return subEstado[idx];
    case 1: return subWiFi[idx];
    case 2: return subPedidos[idx];
    case 3: return subConfig[idx];
    case 4: return subInfo[idx];
  }
  return "";
}

void clearRow(int row) {
  lcd.setCursor(0, row);
  lcd.print("                ");
}

void drawMainMenu() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Menu:");
  clearRow(1);
  lcd.setCursor(0, 1);
  lcd.print("> ");
  lcd.print(mainItems[mainIndex]);
}

void drawSubmenu() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(mainItems[mainIndex]);
  clearRow(1);
  lcd.setCursor(0, 1);
  lcd.print("> ");
  lcd.print(getSubItem(subIndex));
}

String trim16(const String& text) {
  if (text.length() <= 16) return text;
  return text.substring(0, 16);
}

void showMessage(const char* msg, unsigned long ms = 1000) {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(msg);
  delay(ms);
  if (mode == MAIN_MENU) drawMainMenu();
  else drawSubmenu();
}

void showTwoLine(const String& line1, const String& line2, unsigned long ms = 1800) {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(trim16(line1));
  lcd.setCursor(0, 1);
  lcd.print(trim16(line2));
  delay(ms);
  if (mode == MAIN_MENU) drawMainMenu();
  else drawSubmenu();
}

// ------------------ Botones (debounce) ------------------
struct ButtonState {
  int pin;
  bool lastReading;
  bool stableState;
  unsigned long lastChange;
};

const unsigned long DEBOUNCE_MS = 40;

ButtonState btnNext = {BTN_NEXT, HIGH, HIGH, 0};
ButtonState btnOk   = {BTN_OK,   HIGH, HIGH, 0};

bool readButtonPress(ButtonState &b) {
  bool reading = (digitalRead(b.pin) == LOW);
  if (reading != b.lastReading) {
    b.lastChange = millis();
    b.lastReading = reading;
  }
  if ((millis() - b.lastChange) > DEBOUNCE_MS) {
    if (reading != b.stableState) {
      b.stableState = reading;
      if (b.stableState) return true;
    }
  }
  return false;
}

// ------------------ Pedidos (API) ------------------
String readHttpBody(WiFiClient& client) {
  String body;
  bool inBody = false;
  unsigned long timeout = millis() + 3000;
  while (millis() < timeout) {
    while (client.available()) {
      char c = client.read();
      if (inBody) {
        body += c;
      } else if (body.endsWith("\r\n\r\n")) {
        inBody = true;
        body = "";
      } else {
        body += c;
        if (body.endsWith("\r\n\r\n")) {
          inBody = true;
          body = "";
        }
      }
    }
    if (!client.connected()) break;
  }
  return body;
}

String extractJsonString(const String& body, const String& key) {
  int idx = body.indexOf(key);
  if (idx == -1) return "";
  idx += key.length();
  int end = body.indexOf("\"", idx);
  if (end == -1) return "";
  return body.substring(idx, end);
}

long extractJsonNumber(const String& body, const String& key) {
  int idx = body.indexOf(key);
  if (idx == -1) return 0;
  idx += key.length();
  int end = idx;
  while (end < body.length() && (isDigit(body[end]) || body[end] == '.')) end++;
  return body.substring(idx, end).toInt();
}

bool fetchLatestOrder(String& name, long& total) {
  if (WiFi.status() != WL_CONNECTED) return false;

  WiFiSSLClient client;
  if (!client.connect(cfg.apiHost, 443)) return false;

  client.print(String("GET ") + cfg.apiPath + " HTTP/1.1\r\n");
  client.print(String("Host: ") + cfg.apiHost + "\r\n");
  if (strlen(cfg.apiKey) > 0) {
    client.print(String("x-api-key: ") + cfg.apiKey + "\r\n");
  }
  client.print("Connection: close\r\n\r\n");

  String body = readHttpBody(client);
  client.stop();

  if (body.indexOf("\"orders\":[]") != -1) {
    return false;
  }

  name = extractJsonString(body, "\"name\":\"");
  total = extractJsonNumber(body, "\"total\":");

  return name.length() > 0;
}

// ------------------ Acciones ------------------
void doSubAction() {
  int idx = subIndex;

  if (mainIndex == 0) {
    if (idx == 0) { tone(SPK_PIN, cfg.beepHz, 200); showMessage("Buzzer OK"); }
    else if (idx == 1) { showMessage("LCD OK"); }
    else if (idx == 2) { showMessage((WiFi.status()==WL_CONNECTED) ? "WiFi OK" : "WiFi FAIL"); }
    else if (idx == 3) { mode = MAIN_MENU; drawMainMenu(); }
  }

  if (mainIndex == 1) {
    if (idx == 0) { showMessage(wifiStatusText().c_str()); }
    else if (idx == 1) { showMessage(WiFi.localIP().toString().c_str()); }
    else if (idx == 2) { showMessage(String(WiFi.RSSI()).c_str()); }
    else if (idx == 3) { showMessage("Reconect"); connectWiFi(); drawSubmenu(); }
    else if (idx == 4) { mode = MAIN_MENU; drawMainMenu(); }
  }

  if (mainIndex == 2) {
    if (idx == 0) {
      String name;
      long total = 0;
      if (!fetchLatestOrder(name, total)) {
        showMessage("Sin pedidos");
      } else {
        showTwoLine(name, "Total $" + String(total));
      }
    } else if (idx == 1) {
      showTwoLine("API host", String(cfg.apiHost));
    } else if (idx == 2) {
      mode = MAIN_MENU;
      drawMainMenu();
    }
  }

  if (mainIndex == 3) {
    if (idx == 0) { cfg.beepHz += 50; if (cfg.beepHz > 1000) cfg.beepHz = 100; showMessage("Beep Hz"); }
    else if (idx == 1) { cfg.beepMs += 20; if (cfg.beepMs > 500) cfg.beepMs = 60; showMessage("Beep Ms"); }
    else if (idx == 2) { saveConfig(); showMessage("Guardado"); }
    else if (idx == 3) { mode = MAIN_MENU; drawMainMenu(); }
  }

  if (mainIndex == 4) {
    if (idx == 0) { showMessage("Version 1.0"); }
    else if (idx == 1) { String m = "Up " + String(millis() / 1000) + "s"; showMessage(m.c_str()); }
    else if (idx == 2) { mode = MAIN_MENU; drawMainMenu(); }
  }
}

// ------------------ Web config ------------------
String getQueryParam(const String& query, const String& key) {
  String pattern = key + "=";
  int start = query.indexOf(pattern);
  if (start == -1) return "";
  start += pattern.length();
  int end = query.indexOf("&", start);
  if (end == -1) end = query.length();
  String val = query.substring(start, end);
  val.replace("+", " ");
  val.replace("%20", " ");
  return val;
}

void handleWebClient() {
  WiFiClient client = server.available();
  if (!client) return;

  String req = "";
  unsigned long timeout = millis() + 1000;
  while (client.connected() && millis() < timeout) {
    if (client.available()) {
      char c = client.read();
      req += c;
      if (req.endsWith("\r\n\r\n")) break;
    }
  }

  String line = req.substring(0, req.indexOf("\r\n"));
  String query = "";
  bool updated = false;

  if (line.startsWith("GET ")) {
    int sp = line.indexOf(" ", 4);
    String url = line.substring(4, sp);
    int q = url.indexOf("?");
    if (q != -1) query = url.substring(q + 1);

    if (query.length()) {
      String newSsid = getQueryParam(query, "ssid");
      String newPass = getQueryParam(query, "pass");
      String newHz   = getQueryParam(query, "beepHz");
      String newMs   = getQueryParam(query, "beepMs");
      String newHost = getQueryParam(query, "apiHost");
      String newPath = getQueryParam(query, "apiPath");
      String newKey  = getQueryParam(query, "apiKey");

      if (newSsid.length() > 0 && newSsid.length() < sizeof(cfg.ssid)) { newSsid.toCharArray(cfg.ssid, sizeof(cfg.ssid)); updated = true; }
      if (newPass.length() > 0 && newPass.length() < sizeof(cfg.pass)) { newPass.toCharArray(cfg.pass, sizeof(cfg.pass)); updated = true; }
      if (newHz.length() > 0) { cfg.beepHz = newHz.toInt(); updated = true; }
      if (newMs.length() > 0) { cfg.beepMs = newMs.toInt(); updated = true; }
      if (newHost.length() > 0 && newHost.length() < sizeof(cfg.apiHost)) { newHost.toCharArray(cfg.apiHost, sizeof(cfg.apiHost)); updated = true; }
      if (newPath.length() > 0 && newPath.length() < sizeof(cfg.apiPath)) { newPath.toCharArray(cfg.apiPath, sizeof(cfg.apiPath)); updated = true; }
      if (newKey.length() > 0 && newKey.length() < sizeof(cfg.apiKey)) { newKey.toCharArray(cfg.apiKey, sizeof(cfg.apiKey)); updated = true; }

      if (updated) { saveConfig(); connectWiFi(); }
    }
  }

  client.println("HTTP/1.1 200 OK");
  client.println("Content-Type: text/html; charset=utf-8");
  client.println("Connection: close");
  client.println();
  client.println("<!doctype html><html><head><meta charset='utf-8'>");
  client.println("<meta name='viewport' content='width=device-width, initial-scale=1'>");
  client.println("<title>Arduino Config</title>");
  client.println("<style>body{font-family:Arial;margin:0;background:#0f172a;color:#e2e8f0}header{background:#111827;padding:16px;text-align:center}main{padding:16px}.card{background:#1e293b;border-radius:12px;padding:16px;margin-bottom:16px}input,button{width:100%;padding:10px;border-radius:8px;border:none;margin-top:6px}button{background:#38bdf8;color:#0f172a;font-weight:bold}</style>");
  client.println("</head><body><header><h2>Configuracion Arduino</h2></header><main>");

  if (updated) client.println("<div class='card' style='background:#14532d'><b>Config actualizada.</b></div>");

  client.println("<div class='card'><h3>Estado</h3>");
  client.print("<p><b>SSID:</b> "); client.print(WiFi.SSID()); client.println("</p>");
  client.print("<p><b>IP:</b> "); client.print(WiFi.localIP()); client.println("</p>");
  client.print("<p><b>RSSI:</b> "); client.print(WiFi.RSSI()); client.println(" dBm</p>");
  client.print("<p><b>Estado:</b> "); client.print(wifiStatusText()); client.println("</p>");
  client.println("</div>");

  client.println("<div class='card'><h3>API pedidos</h3><form method='GET'>");
  client.print("<label>Host</label><input name='apiHost' value='"); client.print(cfg.apiHost); client.println("'>");
  client.print("<label>Path</label><input name='apiPath' value='"); client.print(cfg.apiPath); client.println("'>");
  client.print("<label>API Key</label><input name='apiKey' value='"); client.print(cfg.apiKey); client.println("'>");
  client.println("<button type='submit'>Guardar API</button></form></div>");

  client.println("<div class='card'><h3>Config</h3><form method='GET'>");
  client.print("<label>SSID</label><input name='ssid' value='"); client.print(cfg.ssid); client.println("'>");
  client.print("<label>Password</label><input name='pass' value='"); client.print(cfg.pass); client.println("'>");
  client.print("<label>Beep Hz</label><input name='beepHz' value='"); client.print(cfg.beepHz); client.println("'>");
  client.print("<label>Beep ms</label><input name='beepMs' value='"); client.print(cfg.beepMs); client.println("'>");
  client.println("<button type='submit'>Guardar</button></form></div>");

  client.println("<div class='card'><h3>Guia</h3><p>Boton 1: desliza opciones.</p><p>Boton 2: entra/ejecuta.</p><p>Pedidos: consulta el ultimo pedido desde la API.</p></div>");
  client.println("</main></body></html>");
  client.stop();
}

// ------------------ Boot sequence ------------------
const int melody[] = {262, 330, 392, 523, 392, 330, 262};
const int noteDur[] = {120, 120, 120, 160, 120, 120, 160};

void playBootMelody() {
  for (int i = 0; i < 7; i++) {
    tone(SPK_PIN, melody[i], noteDur[i]);
    delay(noteDur[i] + 20);
  }
}

void showLoadingBar() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Cargando...");
  lcd.setCursor(0, 1);
  for (int i = 0; i < 16; i++) {
    lcd.write(byte(255));
    delay(80);
  }
}

// ------------------ Setup / Loop ------------------
void setup() {
  pinMode(BTN_NEXT, INPUT_PULLUP);
  pinMode(BTN_OK,   INPUT_PULLUP);
  pinMode(SPK_PIN,  OUTPUT);

  lcd.begin(16, 2);

  loadConfig();

  tone(SPK_PIN, 200, 120);
  delay(150);
  playBootMelody();
  showLoadingBar();

  lcd.clear();
  lcd.print("Conectando");
  connectWiFi();

  lcd.clear();
  if (wifiReady) lcd.print("WiFi OK");
  else lcd.print("WiFi FAIL");
  delay(800);

  drawMainMenu();
}

void loop() {
  if (wifiReady) handleWebClient();

  if (readButtonPress(btnNext)) {
    if (mode == MAIN_MENU) {
      mainIndex = (mainIndex + 1) % mainCount;
      drawMainMenu();
    } else {
      int count = getSubCount();
      subIndex = (subIndex + 1) % count;
      drawSubmenu();
    }
  }

  if (readButtonPress(btnOk)) {
    if (mode == MAIN_MENU) {
      mode = SUBMENU;
      subIndex = 0;
      drawSubmenu();
    } else {
      doSubAction();
    }
  }
}
