import React from 'react';
import deepEqual from 'deep-equal';

export default class BaseComponent extends React.Component {
    static getDerivedStateFromProps(props, state) {
        const updates = {};
        let hasUpdates = false;

        // Compare each prop with corresponding state
        for (const [key, value] of Object.entries(props)) {
            if (key in state && !deepEqual(state[key], value)) {
                updates[key] = value;
                hasUpdates = true;
            }
        }

        return hasUpdates ? updates : null;
    }

    componentDidUpdate(prevProps) {
        const updates = {};
        let hasUpdates = false;

        // Compare each prop with previous props
        for (const [key, value] of Object.entries(this.props)) {
            if (!deepEqual(prevProps[key], value)) {
                if (this.handlePropChange) {
                    this.handlePropChange(key, value, prevProps[key]);
                }
                if (key in this.state) {
                    updates[key] = value;
                    hasUpdates = true;
                }
            }
        }

        if (hasUpdates) {
            this.setState(updates);
        }
    }
}
