# Contributing to Relay

Thank you for your interest in contributing to Relay! We welcome contributions from the community.

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- npm (comes with Node.js)
- A Gemini API key OR [Ollama](https://ollama.ai/) installed locally

### Development Setup

1. **Fork the repository** on GitHub

2. **Clone your fork**
   ```bash
   git clone https://github.com/hibbault/relay.git
   cd relay
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env and add your Gemini API key
   ```

5. **Run in development mode**
   ```bash
   npm run dev
   ```

## 📝 How to Contribute

### Reporting Bugs

- Check if the bug has already been reported in [Issues](../../issues)
- If not, create a new issue with:
  - Clear, descriptive title
  - Steps to reproduce
  - Expected vs actual behavior
  - Your OS and Relay version

### Suggesting Features

- Open a new issue with the `enhancement` label
- Describe the feature and its use case
- Explain why it would benefit users

### Submitting Code

1. **Create a branch** for your changes
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow the existing code style
   - Add comments for complex logic
   - Update documentation if needed

3. **Test your changes**
   ```bash
   npm run lint
   npm test
   ```

4. **Commit with clear messages**
   ```bash
   git commit -m "feat: add new diagnostic for disk health"
   ```

5. **Push and create a Pull Request**
   ```bash
   git push origin feature/your-feature-name
   ```

## 💻 Code Style

- Use ES6+ JavaScript features
- Follow existing patterns in the codebase
- Keep functions focused and modular
- Use descriptive variable and function names

## 🧪 Testing

- Add tests for new features when possible
- Ensure existing tests pass before submitting

## 📜 Commit Message Convention

We use conventional commits:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

## 🤝 Code of Conduct

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.

## ❓ Questions?

Feel free to open an issue for any questions about contributing.

---

Thank you for helping make Relay better! 🎉
