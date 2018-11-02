import { byPriorities, byDirections } from './helpers';

// Can move to @barba/transitions? Kind of "collection" with default?
const defaultTransition = {
  enter() {}, // eslint-disable-line no-empty-function
  leave() {}, // eslint-disable-line no-empty-function
};

export default {
  // Active transition
  active: undefined,
  // Rules and modes, order matters for priorities sorting
  rules: [
    {
      name: 'custom',
      type: 'function',
    },
    {
      name: 'namespace',
      type: 'strings',
    },
  ],
  modes: ['simultaneous', 'in-out', 'out-in'],
  // All vs appear
  all: [defaultTransition],
  appear: [],
  // Global
  wait: false, // Needed to wait for catch or fetch (if "to transition" exists)

  /**
   * Init store
   *
   * @param {array} transitions array of transitions
   * @param {boolean} debug debug mode
   * @returns {store} this instance
   */
  init(transitions, debug) {
    this.debug = debug;

    if (transitions) {
      // TODO: add check for valid transitions? criteria? (appear || enter && leave)
      this.all = this.all.concat(transitions);
    }

    this.update();

    return this;
  },

  /**
   * Update store
   *
   * Reorder transition by priorities
   * Get wait transitions
   * Get appear transitions
   *
   * @returns {undefined}
   */
  update() {
    // Reorder by priorities
    this.rules
      .slice()
      .reverse()
      .forEach(rule => {
        this.all.sort(byPriorities(rule.name));
      });
    this.appear = this.all.filter(t => t.appear && !t.from && !t.to);
    this.wait = this.all.some(t => t.to);
  },

  /**
   * Add rule or transition
   *
   * @param {string} type rule | transition
   * @param {object} data data
   * @returns {undefined}
   */
  add(type, data) {
    switch (type) {
      case 'rule':
        // TODO: check for valid rule
        this.rules.splice(data.position || 0, 0, data.value);
        break;
      case 'transition':
        // TODO: check for valid transition
        this.all.push(data);
        break;
      default:
    }

    this.update();
  },

  /**
   * Get active/matching transition
   *
   * @param {object} data transition data
   * @param {object} data.current current page
   * @param {object} data.next next page
   * @param {object} data.trigger transition trigger
   * @param {boolean} [init=false] for appear transition
   * @returns {object} active transition
   */
  get(data, init = false) {
    const transitions = init ? this.appear : this.all;

    // All matching transition infos
    const matching = new Map();

    // Active = first of valid transitions
    // sorted by directions (from/to, from || to, …)
    [this.active] = transitions
      .filter(t => {
        let valid = true;
        const match = {};

        // Check rules
        // TODO: can probably be refactored…
        this.rules.forEach(rule => {
          if (valid) {
            valid = this.check(t, rule, data, match);
            // From/to
            if (t.from && t.to) {
              valid =
                this.check(t, rule, data, match, 'from') &&
                this.check(t, rule, data, match, 'to');
            }
            if (t.from && !t.to) {
              valid = this.check(t, rule, data, match, 'from');
            }
            if (!t.from && t.to) {
              valid = this.check(t, rule, data, match, 'to');
            }
          }
        });

        matching.set(t, match);

        return valid;
      })
      .sort(byDirections);

    if (this.debug) {
      // Debug info to known criteria applied for matching transition
      // TODO: error/warn/info handler
      console.info(matching.get(this.active));
    }

    return this.active;
  },

  /**
   * Check if transition apply,
   * based on rule, page data and optional direction
   *
   * 1. transition has no rule "property":
   *    - always returns true
   * 2. transition has rule "property":
   *     - "strings" should be present on both side (transition + view) and match
   *     - "function" should return true
   *
   * @param {object} transition transition
   * @param {object} rule rule
   * @param {object} data transition data
   * @param {object} data.current current page
   * @param {object} data.next next page
   * @param {object} data.trigger transition trigger
   * @param {object} match debug object
   * @param {string} direction from | to
   * @returns {boolean} valid check or not
   */
  check(transition, rule, data, match, direction) {
    let isValid = true;
    let hasMatch = false;
    const t = transition;
    const { name, type } = rule;
    const base = direction ? t[direction] : t; // = t || t.from || t.to
    const page = direction === 'to' ? data.next : data.current; // = t || t.from || t.to
    const exist = direction ? base && base[name] : base[name];

    // If transition rule exists
    if (exist) {
      switch (type) {
        case 'strings':
        default: {
          // Array support
          const names = Array.isArray(base[name]) ? base[name] : [base[name]];

          // For matching, prop should be present on both sides and match
          if (page[name] && names.includes(page[name])) {
            hasMatch = true;
          }
          // If transition prop is different from current, not valid
          if (!names.includes(page[name])) {
            isValid = false;
          }
          break;
        }

        case 'function':
          if (base[name](data)) {
            hasMatch = true;
          } else {
            isValid = false;
          }
          break;
      }

      if (hasMatch) {
        if (direction) {
          match[direction] = match[direction] || {};
          match[direction][name] = t[direction][name];
        } else {
          match[name] = t[name];
        }
      }
    }

    return isValid;
  },
};
