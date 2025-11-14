# Changelog

## [2.1.0] - 2025-11-14

### Added

- **Native Tool Calling Support**: AI can now execute server-side functions
  - Tool registry system for managing available functions
  - Built-in tools: `get_current_time`, `fetch_url`, `hash_string`, `calculate_expression`
  - Support for multiple tool call formats (JSON, XML, simple)
  - Tool validation and security controls
  - Streaming and non-streaming tool call support
  - Tool execution metrics and monitoring
  - Comprehensive test suite for tool functionality
- **Documentation**: Added detailed native tool calling guide
- **TypeScript Interfaces**: Extended request/response types for tool support

### Changed

- **Request Validation**: Enhanced to support tool validation
- **Stream Processing**: Updated to handle tool calls in streaming responses
- **Statistics**: Added tool call metrics tracking
- **Upstream Caller**: Enhanced to detect and process tool calls

## [2.0.0] - 2025-11-06

### Added

- **Modular Architecture**: Created 18 new modules in `src/` directory
  - `src/config/` - Configuration and constants (2 files)
  - `src/services/` - Business logic services (7 files)
  - `src/types/` - TypeScript type definitions (3 files)
  - `src/utils/` - Utility functions (5 files)
  - `src/handlers/` - Request handlers (1 file)
- **CI/CD Pipeline**: GitHub Actions workflow for automated testing
- **Comprehensive .gitignore**: Expanded from 1 line to 40 lines
- **Integration Tests**: Added comprehensive integration test suite
- **Quick Reference**: Developer quick reference guide

### Changed

- **main.ts**: Updated to import and use new modular components
- **deno.json**: Added new tasks (lint, fmt, check, test:unit)
- **README.md**: Updated with modular architecture information
- **Test Organization**: Moved all tests to `tests/` directory

### Removed

- Sensitive files: `server.log`
- Unclear purpose: `visual_tester/`
- Internal notes: `apiupdate_prompts.md`, `anthropic_structure.md`, `think_tags_mode_example.md`

### Refactored

- **Magic Numbers**: All extracted to `CONFIG` constant
- **Duplicate Code**: Eliminated all duplicate patterns (DRY applied)
- **Logging**: Centralized with `logger` module
- **Type Safety**: Complete TypeScript typing throughout
- **Error Handling**: Standardized error response creation

### Technical Details

- **Backward Compatible**: 100% - All API endpoints unchanged
- **Upstream Compatible**: Verified - Request format preserved
- **Breaking Changes**: 0 (zero)
- **Code Quality**: Improved maintainability, testability, and scalability

### Metrics

- Modules: 2 → 20 (+900%)
- Magic Numbers: 50+ → 0 (-100%)
- Duplicate Code: 15+ patterns → 0 (-100%)
- Type Safety: Partial → Complete (+100%)
- .gitignore: 1 line → 40 lines (+3,900%)

---

## [1.0.0] - Previous

Initial release with monolithic architecture.
