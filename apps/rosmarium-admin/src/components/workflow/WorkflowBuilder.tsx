import React, { useEffect, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Box } from '@mui/material';

// Basic workflow builder that takes states and transitions and maps them to React Flow nodes/edges
interface WorkflowBuilderProps {
  initialStates: Array<{ key: string; label: string; color?: string; [k: string]: unknown }>;
  initialTransitions: Array<{ from: string; to: string; label: string; [k: string]: unknown }>;
  onChange?: (states: unknown[], transitions: unknown[]) => void;
}

export const WorkflowBuilder: React.FC<WorkflowBuilderProps> = ({ initialStates, initialTransitions }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    // Map initial states to nodes
    const initialNodes: Node[] = initialStates.map((state, i) => ({
      id: state.key,
      position: { x: 100 + i * 200, y: 100 + (i % 2) * 100 },
      data: { label: state.label },
      style: {
        background: state.color || '#fff',
        border: '1px solid #777',
        borderRadius: '4px',
        padding: '10px'
      }
    }));
    setNodes(initialNodes);

    // Map initial transitions to edges
    const initialFlowEdges: Edge[] = initialTransitions.map((t, i) => ({
      id: `e-${t.from}-${t.to}-${i}`,
      source: t.from,
      target: t.to,
      label: t.label,
      animated: true
    }));
    setEdges(initialFlowEdges);
  }, [initialStates, initialTransitions, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges]
  );

  // When nodes/edges change, we should theoretically map them back to the definition.
  // For this basic implementation, we focus on visualizing the existing data.
  // Full CRUD editing of states/transitions via properties panel would be added here.

  return (
    <Box sx={{ width: '100%', height: 500 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </Box>
  );
};
