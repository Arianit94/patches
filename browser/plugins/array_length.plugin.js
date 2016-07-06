var ArrayLengthPlugin = E2.plugins.array_length = function ArrayLengthPlugin(core) {
	this.input_slots = [
		{
			name: 'array',
			dt: E2.dt.ANY,
			array: true,
			def: []
		},
	]

	this.output_slots = [ {
			name: 'length',
			dt: core.datatypes.FLOAT
		}
	]

	this.length = 0
}

ArrayLengthPlugin.prototype.connection_changed = function(on, conn, slot) {
	if (slot.type !== E2.slot_type.input)
		return;

	if (on)
		this.input_slots[0].dt = conn.src_slot.dt
	else
		this.input_slots[0].dt = E2.dt.ANY
}

ArrayLengthPlugin.prototype.reset = function() {
	this.length = 0
}

ArrayLengthPlugin.prototype.update_input = function(slot, data) {
	this.length = data ? data.length : 0
}

ArrayLengthPlugin.prototype.update_output = function() {
	return this.length
}
