# 🖥️ Relay - Your Personal AI IT Assistant

> *"Never feel alone with your computer problems again"*

**Relay** is a friendly, always-available AI assistant that lives on your computer and helps non-technical users solve their computer problems. Think of it as having a patient, knowledgeable IT professional available 24/7, right on your desktop.

> [!NOTE]
> **This project is open-source.** Some advanced features may be offered under a paid license in the future to support long-term development.

---

## 💡 The Problem We're Solving

Every day, millions of non-technical users face computer issues that seem simple to tech-savvy people but feel overwhelming to them:

- 🐌 "My computer is so slow, but I don't know why"
- 🔇 "My sound suddenly stopped working"
- 🦠 "I think I have a virus but I'm not sure"
- 🖨️ "My printer won't connect anymore"
- 💾 "I'm running out of disk space"
- 🔒 "I keep getting weird pop-ups"

**Current solutions fail these users:**
- ❌ **Google/Stack Overflow**: Too technical, overwhelming, scary to execute
- ❌ **IT Support Lines**: Long waits, expensive, not always available
- ❌ **Friends/Family**: Annoying them repeatedly, not always available
- ❌ **Existing AI assistants**: No access to system, can only give advice

## 🎯 Our Solution: Relay

Relay is different because it:
- ✅ **Actually executes fixes** - Not just advice, real actions
- ✅ **Speaks human** - No jargon, friendly explanations
- ✅ **Knows your system** - Learns your computer's specifics on install
- ✅ **Safe by design** - Asks permission, explains risks, can rollback
- ✅ **Available 24/7** - No waiting, no subscriptions for basic help
- ✅ **Gets smarter** - Learns from your system over time

---

## 🏗️ How It Works

### 1. System Profiling (On Install)
When you install Relay, it creates a "profile" of your system:
- Hardware specs (CPU, RAM, Storage, GPU)
- Installed software catalog
- System configuration
- Driver inventory
- Baseline performance metrics

### 2. Conversational Interface
Users describe their problem naturally:
> "My computer is running really slow today and I need to get work done"

### 3. Intelligent Analysis
Relay investigates the issue:
- Checks current CPU/Memory/Disk usage
- Reviews running processes and services
- Compares against baseline metrics
- Identifies anomalies and potential causes

### 4. Diagnosis & Solution
Presents findings in plain language:
> "I found the issue! Google Chrome is using a lot of memory because you have 47 tabs open. Also, there's a Windows update running in the background. Would you like me to help with this?"

### 5. Guided or Automatic Fixing
Offers multiple resolution paths:
- 🤖 **"Fix it for me"** - Relay executes the fix
- 👀 **"Show me how"** - Step-by-step guidance with screenshots
- 📖 **"Explain first"** - Detailed explanation before any action

### 6. Verification
After fixing, Relay:
- Tests if the fix worked
- Reports results to user
- Provides prevention tips

---

## 🎨 Core Features

### 🔍 Diagnostics Engine
- **System Health Monitor**: Real-time CPU, RAM, Disk, Network stats
- **Process Inspector**: Identify resource-hungry applications
- **Service Auditor**: Check critical services status
- **Startup Analyzer**: Find programs slowing boot time
- **Storage Scanner**: Locate large files and cleanup opportunities
- **Security Scanner**: Check for common vulnerabilities

### 🛠️ Fix Engine
- **Performance Optimization**: Clear caches, manage startup, optimize settings
- **Driver Management**: Update, rollback, reinstall drivers
- **Software Fixes**: Repair installations, clear corrupted data
- **Network Troubleshooter**: DNS fixes, adapter resets, firewall checks
- **Audio/Video Fixes**: Driver updates, default device settings
- **Malware Detection**: Scan for suspicious processes/files

### 🛡️ Safety System
- **Explain Mode**: Every action explained before execution
- **Approval Gates**: Dangerous operations require explicit consent
- **Rollback Points**: System restore before major changes
- **Audit Log**: Complete history of all actions taken
- **Sandbox Testing**: Test fixes in isolation when possible

### 📚 Knowledge Base
- Common problem patterns
- System-specific solutions
- User history and preferences
- Learning from successful fixes




## 🛠️ Technology Stack

| Component | Technology | Why |
|-----------|------------|-----|
| Desktop App | **Electron / Tauri** | Cross-platform, native system access |
| UI Framework | **React** | Rich interactive chat interface |
| Backend Core | **Python** | Rich ecosystem for system scripts |
| AI Engine | **Gemini API / Local LLM** | NLU and reasoning |
| Database | **SQLite** | Local, no server needed |
| System Scripts | **Python + PowerShell/Bash** | OS-native capabilities |
| Packaging | **PyInstaller / Electron Builder** | Easy distribution |

---





## 📞 Getting Started

```bash
# Clone the repository
git clone https://github.com/yourusername/relay.git

# Navigate to project
cd relay

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env and add your Gemini API key (get from https://aistudio.google.com/app/apikey)
# Or leave empty to use Ollama locally

# Run Relay
npm start
```

---

## 📜 License

Apache License 2.0 - See [LICENSE](LICENSE) for details

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

<div align="center">

**Made with ❤️ for everyone who just wants their computer to work**

*Relay - Because you deserve a patient tech friend*

</div>
