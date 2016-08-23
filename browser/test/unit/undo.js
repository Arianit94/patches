var assert = require('assert');
var EventEmitter = require('events').EventEmitter;

global.E2 = {}

E2.Variables = function(){}
global.EventEmitter = EventEmitter // XXX
global.Graph = require('../../scripts/graph');
global.Connection = require('../../scripts/connection').Connection;
global.Node = require('../../scripts/node').Node

global.Flux = require('../../vendor/flux')

var helpers = require('./plugins/helpers')
var Connection = require('../../scripts/connection').Connection
var Graph = require('../../scripts/graph');
var GraphApi = require('../../scripts/graphApi');
global.Store = require('../../scripts/stores/store');
var GraphStore = require('../../scripts/stores/graphStore');
var UndoManager = require('../../scripts/commands/undoManager');

var commands = require('../../scripts/commands/graphEditCommands')

describe('Undo', function() {
	var graph
	var undoManager

	function makeNode() {
		return Node.hydrate(graph.uid, {
			uid: E2.uid(),
			plugin: 'const_float_generator'
		})
	}

	function makeSlot(slots, type) {
		var slot = {
			type: type,
			index: slots.length
		}
		slots.push(slot)
		return slot
	}

	beforeEach(function() {
		helpers.reset()
		E2.commands = { graph: commands }
		
		undoManager = new UndoManager()
		
		E2.app.undoManager = undoManager
		E2.app.dispatcher = new Flux.Dispatcher()
		E2.app.graphStore = new GraphStore()
		E2.app.graphApi = new GraphApi(undoManager)

		graph = new Graph()
		E2.core.root_graph = E2.core.active_graph = graph
		E2.core.graphs = [graph]
	})

	describe('Manager', function() {
		beforeEach(function() {
		})

		it('shows as undoable when item pushed', function() {
			undoManager.push({})
			assert.ok(undoManager.isUndoable())
			assert.ok(!undoManager.isRedoable())
		})

		it('shows as redoable when item undone', function() {
			undoManager.push({ undo: function() {} })
			undoManager.undo()
			assert.ok(undoManager.isRedoable())
			assert.ok(!undoManager.isUndoable())
		})

		it('pushes to stack on execute', function(done) {
			undoManager.execute({ undo: done, redo: function(){} })
			undoManager.undo()
		})

		it('calls undo method', function(done) {
			undoManager.push({ undo: done })
			undoManager.undo()
		})

		it('calls redo method', function(done) {
			undoManager.push({ undo: function() {}, redo: done })
			undoManager.undo()
			undoManager.redo()
		})

		it('lists undo stack', function() {
			undoManager.push({ title: 'Undo test' })
			var us = undoManager.getUndoStack()
			assert.equal(us.length, 1)
			assert.equal(us[0].title, 'Undo test')
		})

		it('winds the stacks correctly', function() {
			var efn = function(){}
			undoManager.execute({ title: 'Do 1', undo: efn, redo: efn })
			undoManager.execute({ title: 'Do 2', undo: efn, redo: efn })
			// [Do 1, Do 2], []

			assert.equal(undoManager.undoStack[0].title, 'Do 1')
			assert.equal(undoManager.undoStack[1].title, 'Do 2')

			undoManager.undo()
			// [Do 1], [Do 2]
			assert.equal(undoManager.undoStack.length, 1)
			assert.equal(undoManager.redoStack.length, 1)
			assert.equal(undoManager.undoStack[0].title, 'Do 1')
			assert.equal(undoManager.redoStack[0].title, 'Do 2')

			undoManager.undo()
			// [], [Do 2, Do 1]
			assert.equal(undoManager.undoStack.length, 0)
			assert.equal(undoManager.redoStack.length, 2)
			assert.equal(undoManager.redoStack[0].title, 'Do 2')
			assert.equal(undoManager.redoStack[1].title, 'Do 1')

			undoManager.redo()
			// [Do 1], [Do 2]
			assert.equal(undoManager.undoStack.length, 1)
			assert.equal(undoManager.redoStack.length, 1)
			assert.equal(undoManager.undoStack[0].title, 'Do 1')
			assert.equal(undoManager.redoStack[0].title, 'Do 2')

			undoManager.redo()
			// [Do 1, Do 2], []
			assert.equal(undoManager.undoStack.length, 2)
			assert.equal(undoManager.redoStack.length, 0)
			assert.equal(undoManager.undoStack[0].title, 'Do 1')
			assert.equal(undoManager.undoStack[1].title, 'Do 2')
		})

		it('can group actions', function() {
			var redos = 0, undos = 0

			function redo() {
				redos++
			}
			function undo() {
				undos++
			}

			undoManager.begin('Test')

			undoManager.execute({ title: 'One', redo: redo, undo: undo })
			undoManager.execute({ title: 'Two', redo: redo, undo: undo })
			undoManager.execute({ title: 'Three', redo: redo, undo: undo })

			assert.equal(undoManager.undoStack.length, 0)
			assert.equal(undoManager._transaction.undoStack.length, 3)

			undoManager.end()

			assert.ok(redos, 3)
			assert.equal(undoManager.undoStack.length, 1)
			assert.equal(undoManager.undoStack[0].title, 'Test')
			assert.equal(undoManager._transaction, null)

			undoManager.undo()

			assert.ok(undos, 3)
		})

		it('handles multiple nested transactions', function() {
			var redos = 0, undos = 0

			function redo() {
				redos++
			}
			function undo() {
				undos++
			}

			undoManager.begin('Test')
			var firstXa = undoManager._transaction
			undoManager.begin('Test2')
			undoManager.execute({ title: 'One.2', redo: redo, undo: undo })
			undoManager.begin('Test3')
			undoManager.execute({ title: 'One.3', redo: redo, undo: undo })
			assert.equal(undoManager._nestedTransactions, 3)
			assert.equal(undoManager._transaction, firstXa)
			undoManager.execute({ title: 'Two', redo: redo, undo: undo })
			undoManager.execute({ title: 'Three', redo: redo, undo: undo })
			undoManager.end()
			assert.equal(undoManager._nestedTransactions, 2)
			undoManager.end()
			assert.equal(undoManager._nestedTransactions, 1)
			undoManager.end()
			assert.equal(undoManager._nestedTransactions, 0)

			assert.equal(redos, 4)
			assert.equal(undoManager._transaction, null)

			undoManager.undo()

			assert.ok(undos, 4)
		})	
	})

	describe('AddNode', function() {
		it('AddNode execute', function() {
			assert.equal(graph.nodes.length, 0)

			var cmd = new E2.commands.graph.AddNode(graph, makeNode())
			cmd.execute()

			assert.equal(graph.nodes.length, 1)
		});

		it('AddNode undo', function() {
			assert.equal(graph.nodes.length, 0)

			var cmd = new E2.commands.graph.AddNode(graph, makeNode())
			cmd.execute()
			cmd.undo()

			assert.equal(graph.nodes.length, 0)
		});
	});

	describe('RemoveNode', function() {
		it('RemoveNode execute', function() {
			var n = makeNode()
	
			graph.addNode(n)
			assert.equal(graph.nodes.length, 1)
	
			var cmd = new E2.commands.graph.RemoveNode(graph, n)
			cmd.execute()

			assert.equal(graph.nodes.length, 0)
		});

		it('RemoveNode undo', function() {
			var n = makeNode()
	
			graph.addNode(n)
			assert.equal(graph.nodes.length, 1)
	
			var cmd = new E2.commands.graph.RemoveNode(graph, n)
			cmd.execute()
			cmd.undo()

			assert.equal(graph.nodes.length, 1)
		});
	});

	describe('Connect', function() {
		it('Connect execute', function() {
			assert.equal(graph.nodes.length, 0)

			var n1 = makeNode()
			var n2 = makeNode()
			var ss = makeSlot(n1.plugin.output_slots, E2.slot_type.output)
			var ds = makeSlot(n2.plugin.input_slots, E2.slot_type.input)

			graph.nodes.push(n1)
			graph.nodes.push(n2)

			var connection = new Connection(n1, n2, ss, ds, 0)
			var cmd = new E2.commands.graph.Connect(graph, connection)
			cmd.execute()

			assert.equal(graph.connections.length, 1)
			assert.equal(graph.nodes.length, 2)
		});

		it('Connect undo', function() {
			assert.equal(graph.nodes.length, 0)

			var n1 = makeNode()
			var n2 = makeNode()
			var ss = makeSlot(n1.plugin.output_slots, E2.slot_type.output)
			var ds = makeSlot(n2.plugin.input_slots, E2.slot_type.input)

			graph.nodes.push(n1)
			graph.nodes.push(n2)

			var connection = new Connection(n1, n2, ss, ds, 0)
			var cmd = new E2.commands.graph.Connect(graph, connection)
			cmd.execute()
			cmd.undo()

			assert.equal(graph.connections.length, 0)
			assert.equal(graph.nodes.length, 2)
		});
	});

	describe('Disconnect', function() {
		it('Disconnect execute', function() {
			assert.equal(graph.nodes.length, 0)

			var n1 = makeNode()
			var n2 = makeNode()
			var ss = makeSlot(n1.plugin.output_slots, E2.slot_type.output)
			var ds = makeSlot(n2.plugin.input_slots, E2.slot_type.input)

			graph.nodes.push(n1)
			graph.nodes.push(n2)

			var conn = new Connection(n1, n2, ss, ds, 0)
			graph.connect(conn)

			assert.equal(graph.connections.length, 1)

			var cmd = new E2.commands.graph.Disconnect(graph, conn)
			cmd.execute()

			assert.equal(graph.connections.length, 0)
		});

		it('Disconnect undo', function() {
			assert.equal(graph.nodes.length, 0)

			var n1 = makeNode()
			var n2 = makeNode()
			var ss = makeSlot(n1.plugin.output_slots, E2.slot_type.output)
			var ds = makeSlot(n2.plugin.input_slots, E2.slot_type.input)

			graph.nodes.push(n1)
			graph.nodes.push(n2)

			var conn = new Connection(n1, n2, ss, ds, 0)
			graph.connect(conn)

			assert.equal(graph.connections.length, 1)

			var cmd = new E2.commands.graph.Disconnect(graph, conn)
			cmd.execute()
			cmd.undo()

			assert.equal(graph.connections.length, 1)
		});
	});

	describe('GraphApi', function() {
		var n1, n2, ss, ds
		beforeEach(function() {
			n1 = makeNode()
			n2 = makeNode()
			ss = makeSlot(n1.plugin.output_slots, E2.slot_type.output)
			ds = makeSlot(n2.plugin.input_slots, E2.slot_type.input)
			api = new GraphApi(undoManager)
			graph.registerNode(n1)
			graph.registerNode(n2)
		})

		it('can add nodes', function() {
			assert.equal(graph.nodes.length, 2)
			api.addNode(graph, makeNode())
			assert.equal(graph.nodes.length, 3)
		})

		it('can remove nodes', function() {
			var n = makeNode()
			api.addNode(graph, n)
			assert.equal(graph.nodes.length, 3)
			api.removeNode(graph, n)
			assert.equal(graph.nodes.length, 2)
		})

		it('can connect nodes', function() {
			assert.equal(graph.connections.length, 0)
			var conn = new Connection(n1, n2, ss, ds, 0)
			api.connect(graph, conn)
			assert.equal(graph.connections.length, 1)
		})

		it('can disconnect nodes', function() {
			var conn = new Connection(n1, n2, ss, ds, 0)
			api.connect(graph, conn)
			api.disconnect(graph, conn)
			assert.equal(graph.connections.length, 0)
		})

	})



});

