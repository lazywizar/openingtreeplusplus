import React from 'react';
import deepEqual from 'deep-equal';

export default class BaseComponent extends React.Component {
    static getDerivedStateFromProps(props, state) {
        // By default, don't sync any props to state
        // Components can override this method if they need specific prop-to-state syncing
        return null;
    }

    componentDidUpdate(prevProps) {
        // Compare each prop with previous props
        for (const [key, value] of Object.entries(this.props)) {
            if (!deepEqual(prevProps[key], value)) {
                if (this.handlePropChange) {
                    this.handlePropChange(key, value, prevProps[key]);
                }
            }
        }
    }
}
