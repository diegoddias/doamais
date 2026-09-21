/** Manual de uso embutido no proprio sistema, conforme previsto no projeto. */
import { Layout } from '../components/Layout'
import { Cartao } from '../components/ui'

export function Manual() {
  return (
    <Layout
      titulo="Manual de uso"
      descricao="Como operar o Doa+ no dia a dia. Escrito para quem nunca usou um sistema de estoque."
      acoes={
        <button className="botao botao-secundario" onClick={() => window.print()}>
          Imprimir manual
        </button>
      }
    >
      <Cartao className="manual">
        <h3>1. O que este sistema faz</h3>
        <p>
          O Doa+ guarda o registro de tudo que a instituição <strong>recebe</strong> de doação e de
          tudo que <strong>entrega</strong> à comunidade. Com isso ele responde, a qualquer momento,
          três perguntas que antes dependiam da memória dos voluntários:
        </p>
        <ul>
          <li>O que temos em estoque hoje?</li>
          <li>O que está faltando e o que está perto de vencer?</li>
          <li>Para onde foi o que a pessoa doou?</li>
        </ul>

        <h3>2. Entrando no sistema</h3>
        <p>
          Cada voluntário tem o próprio e-mail e senha. Quem coordena a ação social cadastra os
          novos voluntários em <strong>Voluntários</strong>. Nunca compartilhe sua senha: é ela que
          registra quem fez cada lançamento.
        </p>
        <div className="passo">
          Esqueceu a senha? Peça a um administrador para definir uma nova em{' '}
          <strong>Voluntários → Editar → Nova senha</strong>.
        </div>

        <h3>3. Registrando uma doação recebida</h3>
        <p>Esta é a tarefa mais frequente. Faça sempre no momento em que o donativo chega.</p>
        <ol>
          <li>
            No menu, clique em <strong>Doações recebidas</strong> e depois no botão{' '}
            <strong>+ Registrar doação</strong>.
          </li>
          <li>
            Confira a <strong>data do recebimento</strong> (já vem preenchida com hoje).
          </li>
          <li>
            Escolha o <strong>doador</strong>. Se a pessoa não quis se identificar, deixe como
            "Doador anônimo". Se é um doador novo, cadastre-o antes em <strong>Doadores</strong>.
          </li>
          <li>
            Para cada tipo de item, escolha o item na lista, digite a quantidade e — se for
            alimento ou produto com prazo — informe a <strong>validade</strong>. Use{' '}
            <strong>+ Adicionar outro item</strong> para incluir mais linhas.
          </li>
          <li>
            Clique em <strong>Salvar doação</strong>. O estoque é atualizado na hora.
          </li>
        </ol>
        <div className="passo">
          <strong>Validades diferentes do mesmo item?</strong> Registre uma linha para cada
          validade. O sistema controla cada lote separadamente e sempre sugere gastar primeiro o
          que vence antes.
        </div>

        <h3>4. Registrando uma entrega</h3>
        <ol>
          <li>
            No menu, clique em <strong>Destinações</strong> e depois em{' '}
            <strong>+ Registrar entrega</strong>.
          </li>
          <li>
            Escreva <strong>quem recebeu</strong> — o nome da família ou da entidade. Quanto mais
            específico, melhor para a prestação de contas.
          </li>
          <li>Escolha os itens e as quantidades entregues.</li>
          <li>
            Clique em <strong>Salvar entrega</strong>. O sistema dá baixa automaticamente,
            começando pelos lotes que vencem antes.
          </li>
        </ol>
        <p className="texto-suave">
          Só aparecem na lista os itens que existem em estoque. Se um item não aparece, é porque o
          saldo está zerado.
        </p>

        <h3>5. Acompanhando o estoque</h3>
        <p>
          A tela <strong>Estoque</strong> mostra o saldo de cada item. As cores indicam o que
          precisa de atenção:
        </p>
        <ul>
          <li>
            <strong>Fundo amarelo</strong> — o item está abaixo do estoque mínimo. Precisa ser
            reposto.
          </li>
          <li>
            <strong>Fundo vermelho</strong> — há itens vencidos. Separe e dê baixa.
          </li>
        </ul>
        <p>
          O quadro no topo lista os lotes que vencem nos próximos 30 dias. Use esses itens primeiro
          nas próximas entregas.
        </p>
        <div className="passo">
          <strong>Item vencido ou estragado:</strong> use o botão <strong>Dar baixa</strong> na
          linha do item. Isso <em>não</em> é uma entrega — é uma perda, e entra no relatório como
          tal. Entregas para a comunidade vão sempre em Destinações.
        </div>

        <h3>6. Definindo o estoque mínimo</h3>
        <p>
          Em <strong>Catálogo de itens</strong>, cada item tem um <strong>estoque mínimo</strong>.
          É esse número que faz o sistema avisar que algo está em falta — e é ele que decide o que
          a comunidade vê na página pública de doação. Ajuste-o conforme a realidade da
          instituição: quanto de cada item vocês precisam ter guardado para atender com
          tranquilidade.
        </p>

        <h3>7. O canal público (QR Code)</h3>
        <p>
          Em <strong>Divulgação e QR Code</strong> você baixa o código para colar em cartazes e
          publicar nas redes. Quem apontar a câmera vê a lista atualizada do que falta e pode
          registrar o que pretende doar.
        </p>
        <p>
          Essas ofertas chegam em <strong>Quero doar</strong>. O fluxo é:
        </p>
        <ol>
          <li>A oferta chega como <strong>Pendente</strong>.</li>
          <li>
            Um voluntário liga ou manda mensagem e muda a situação para <strong>Em contato</strong>.
          </li>
          <li>
            Quando a doação chega de fato, mude para <strong>Recebida</strong> e registre-a em{' '}
            <strong>Doações recebidas</strong>.
          </li>
        </ol>
        <div className="passo">
          A oferta no "Quero doar" é só uma intenção — ela <strong>não</strong> mexe no estoque.
          Quem atualiza o estoque é o registro da doação recebida.
        </div>

        <h3>8. Relatórios e prestação de contas</h3>
        <p>
          Em <strong>Relatórios</strong>, escolha um período e clique em{' '}
          <strong>Gerar relatório</strong>. Você obtém quanto entrou, quanto saiu, quanto se
          perdeu, os itens mais e menos doados, para quem os donativos foram e quem mais doou.
        </p>
        <ul>
          <li>
            <strong>Exportar CSV</strong> gera um arquivo que abre no Excel ou no Google Planilhas.
          </li>
          <li>
            <strong>Imprimir / PDF</strong> gera uma versão para anexar a relatórios e prestações
            de contas.
          </li>
        </ul>

        <h3>9. Rotina sugerida</h3>
        <ul>
          <li>
            <strong>A cada doação recebida:</strong> registre na hora. Deixar para depois é a
            principal causa de erro no estoque.
          </li>
          <li>
            <strong>A cada entrega:</strong> registre quem recebeu e o quê.
          </li>
          <li>
            <strong>Uma vez por semana:</strong> abra o Painel, confira os itens em falta e os
            vencimentos próximos.
          </li>
          <li>
            <strong>Uma vez por mês:</strong> gere o relatório do mês e compartilhe com a
            coordenação e com os doadores.
          </li>
        </ul>

        <h3>10. Problemas comuns</h3>
        <ul>
          <li>
            <strong>"Saldo insuficiente" ao registrar uma entrega</strong> — o sistema não deixa
            entregar mais do que existe. Confira o saldo em Estoque; se a diferença for real,
            provavelmente falta registrar alguma doação recebida.
          </li>
          <li>
            <strong>Registrei uma doação errada</strong> — um administrador pode estornar em
            Doações recebidas. Se parte dos itens já foi entregue, o estorno é bloqueado: nesse
            caso, corrija com uma baixa em Estoque (motivo "Ajuste de inventário").
          </li>
          <li>
            <strong>Item não aparece na lista</strong> — verifique se ele está ativo no Catálogo de
            itens. Se não existir, cadastre-o.
          </li>
          <li>
            <strong>"Sua sessão expirou"</strong> — é normal após várias horas. Basta entrar de
            novo.
          </li>
        </ul>
      </Cartao>
    </Layout>
  )
}
